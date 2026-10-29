import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_BRANCH_RECORDS } from './src/data/initialBranches.ts';
import type {
  Branch,
  Order,
  StockMovement,
  StockAlert,
  UserSession,
  WarehouseInventory,
  ValidationIssue,
  StockHealthStatus,
  StockCategory,
} from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'eyekart_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  branches: Branch[];
  orders: Order[];
  movements: StockMovement[];
  alerts: StockAlert[];
  validationIssues: ValidationIssue[];
  warehouse: WarehouseInventory;
  users: UserSession[];
  settings: {
    defaultMinThreshold: number;
    companyName: string;
    timezone: string;
    currency: string;
  };
  lastInitializedAt: string;
}

// In-memory cache synced to disk
let dbState: DatabaseSchema | null = null;
let saveQueue = Promise.resolve();

// Mutex locks for concurrency protection
const orderOperationLocks = new Set<string>();
const idempotencyStore = new Map<string, { status: number; body: any; timestamp: number }>();

function computeStatus(totalOnHand: number, minThreshold: number): StockHealthStatus {
  if (totalOnHand === 0) return 'OUT_OF_STOCK';
  if (totalOnHand < minThreshold) return 'LOW_STOCK';
  return 'HEALTHY';
}

function getInitialDbState(): DatabaseSchema {
  const now = new Date().toISOString();

  const branches: Branch[] = INITIAL_BRANCH_RECORDS.map((seed) => {
    const totalOnHand = seed.maleFrames + seed.femaleFrames + seed.kidsFrames;
    const minThreshold = 50;
    const status = computeStatus(totalOnHand, minThreshold);

    return {
      id: `br-${seed.srn.toString().padStart(3, '0')}`,
      srn: seed.srn,
      name: seed.originalBranchName,
      originalName: seed.originalBranchName,
      hasNameAnomaly: seed.hasNameAnomaly,
      anomalyReason: seed.anomalyReason,
      isVerified: !seed.hasNameAnomaly,
      remarks: seed.remarks,
      minThreshold,
      status,
      isActive: true,
      inventory: {
        male: {
          onHand: seed.maleFrames,
          reserved: 0,
          available: seed.maleFrames,
          pendingRequested: 0,
          approved: 0,
          dispatched: 0,
          received: 0,
        },
        female: {
          onHand: seed.femaleFrames,
          reserved: 0,
          available: seed.femaleFrames,
          pendingRequested: 0,
          approved: 0,
          dispatched: 0,
          received: 0,
        },
        kids: {
          onHand: seed.kidsFrames,
          reserved: 0,
          available: seed.kidsFrames,
          pendingRequested: 0,
          approved: 0,
          dispatched: 0,
          received: 0,
        },
        totalOnHand,
        totalAvailable: totalOnHand,
        totalPendingRequested: 0,
        totalDispatched: 0,
      },
      createdAt: now,
      updatedAt: now,
      lastStockMovementAt: now,
    };
  });

  const alerts: StockAlert[] = [];
  branches.forEach((b) => {
    if (b.status === 'OUT_OF_STOCK' || b.status === 'LOW_STOCK') {
      alerts.push({
        id: `alt-${b.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        branchId: b.id,
        branchName: b.name,
        currentStock: b.inventory.totalOnHand,
        minThreshold: b.minThreshold,
        shortageAmount: Math.max(0, b.minThreshold - b.inventory.totalOnHand),
        maleBalance: b.inventory.male.onHand,
        femaleBalance: b.inventory.female.onHand,
        kidsBalance: b.inventory.kids.onHand,
        severity: b.inventory.totalOnHand === 0 ? 'CRITICAL_ZERO' : 'LOW_STOCK',
        detectedAt: now,
        acknowledged: false,
        recommendedAction:
          b.inventory.totalOnHand === 0
            ? 'Critical: Branch completely out of frames. Dispatch emergency batch immediately (min 50+ frames).'
            : `Low stock detected (${b.inventory.totalOnHand}/${b.minThreshold}). Generate replenishment order of ${b.minThreshold - b.inventory.totalOnHand}+ frames.`,
      });
    }
  });

  const movements: StockMovement[] = branches.map((b) => ({
    id: `mvt-init-${b.id}`,
    timestamp: now,
    branchId: b.id,
    branchName: b.name,
    movementType: 'INITIAL_IMPORT',
    category: 'all',
    previousOnHand: 0,
    quantityChanged: b.inventory.totalOnHand,
    resultingOnHand: b.inventory.totalOnHand,
    maleChanged: b.inventory.male.onHand,
    femaleChanged: b.inventory.female.onHand,
    kidsChanged: b.inventory.kids.onHand,
    previousCategoryOnHand: { male: 0, female: 0, kids: 0 },
    resultingCategoryOnHand: {
      male: b.inventory.male.onHand,
      female: b.inventory.female.onHand,
      kids: b.inventory.kids.onHand,
    },
    actor: 'System (SSD Frame Supply List Import)',
    reason: `Initial stock imported from spreadsheet reference (SRN ${b.srn})`,
  }));

  const validationIssues: ValidationIssue[] = [
    {
      id: 'val-busia-anomaly',
      type: 'NAME_ANOMALY',
      title: 'Spreadsheet Formula Artifact in Branch Name',
      description:
        "The first branch name appears as 'Bliss BusiaB3:D27' due to spreadsheet range drag/formula artifact 'B3:D27'. Canonical recommended name: 'Bliss Busia'.",
      branchId: 'br-001',
      srn: 1,
      severity: 'WARNING',
      status: 'PENDING_REVIEW',
      resolutionAction: 'Verify canonical branch name and strip formula suffix.',
    },
    {
      id: 'val-srn-gap-3',
      type: 'SRN_GAP',
      title: 'SRN Sequence Gap at Index 3',
      description:
        'SRN #3 is absent in the source spreadsheet (jumps from SRN 2 Bliss Diani to SRN 4 Bliss Eldama Ravine). Preserved accurately without creating fake branches.',
      srn: 3,
      severity: 'INFO',
      status: 'RESOLVED',
    },
    {
      id: 'val-srn-gap-35',
      type: 'SRN_GAP',
      title: 'SRN Sequence Gap at Index 35',
      description:
        'SRN #35 is absent in the source spreadsheet (jumps from SRN 34 Clinix Haille Selasie to SRN 36 Medicross Nakuru). Preserved accurately without creating fake branches.',
      srn: 35,
      severity: 'INFO',
      status: 'RESOLVED',
    },
    {
      id: 'val-total-check',
      type: 'TOTAL_CHECK',
      title: 'Sheet Total Reconciliation Audit',
      description:
        'Spreadsheet Cell reported total: 3,740 frames. Calculated sum of all 35 imported branch records: 3,740 frames (Male: 1,500, Female: 1,830, Kids: 410). Exact match verified.',
      severity: 'INFO',
      status: 'RESOLVED',
    },
    {
      id: 'val-zero-stock-branches',
      type: 'ZERO_STOCK',
      title: '4 Branches Highlighted with Zero Stock',
      description:
        'Bliss Diani, Bliss Iten, Bliss Ol Kalou, Bliss Rongai are visibly highlighted in sheet with 0 frames. Imported faithfully with 0 stock and immediate alerts.',
      severity: 'WARNING',
      status: 'RESOLVED',
    },
    {
      id: 'val-siaya-kids-zero',
      type: 'CATEGORY_ZERO',
      title: 'Bliss Siaya Zero Kids Frames',
      description:
        "Bliss Siaya explicitly shows 40 Male, 50 Female, 0 Kids frames in spreadsheet (total 90). Faithfully preserved as 0 kids frames.",
      branchId: 'br-030',
      srn: 30,
      severity: 'INFO',
      status: 'RESOLVED',
    },
  ];

  const users: UserSession[] = [
    {
      id: 'usr-sarah',
      name: 'Sarah Wanjiku',
      email: 'sarah.wanjiku@eyekart.co.ke',
      role: 'RECEPTIONIST',
      title: 'Front Desk & Receptionist (Nairobi Central)',
    },
    {
      id: 'usr-david',
      name: 'David Kiprop',
      email: 'oram67672@gmail.com', // Authenticated administrator
      role: 'ADMIN',
      title: 'Chief Stock Administrator & Operations Lead',
    },
    {
      id: 'usr-james',
      name: 'James Mwangi',
      email: 'james.mwangi@eyekart.co.ke',
      role: 'BRANCH_USER',
      title: 'Branch Supervisor (Bliss Eldoret Zion Mall)',
      assignedBranchId: 'br-005',
    },
  ];

  return {
    branches,
    orders: [],
    movements,
    alerts,
    validationIssues,
    warehouse: {
      maleOnHand: 4500,
      femaleOnHand: 4500,
      kidsOnHand: 2000,
      totalOnHand: 11000,
      lastRestockedAt: now,
    },
    users,
    settings: {
      defaultMinThreshold: 50,
      companyName: 'Eyekart Healthcare Limited',
      timezone: 'Africa/Nairobi',
      currency: 'KES',
    },
    lastInitializedAt: now,
  };
}

function loadDatabase(): DatabaseSchema {
  if (dbState) return dbState;

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(content);
      return dbState!;
    } catch (err) {
      console.error('Failed to parse database file, re-initializing:', err);
    }
  }

  dbState = getInitialDbState();
  saveDatabaseSync(dbState);
  return dbState;
}

function saveDatabaseSync(state: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

function persistDb(): Promise<void> {
  if (!dbState) return Promise.resolve();
  saveQueue = saveQueue
    .then(() => {
      saveDatabaseSync(dbState!);
    })
    .catch((err) => {
      console.error('Error persisting database:', err);
    });
  return saveQueue;
}

function syncAlerts(state: DatabaseSchema) {
  const now = new Date().toISOString();
  state.branches.forEach((branch) => {
    const total = branch.inventory.totalOnHand;
    const threshold = branch.minThreshold;
    const isShortage = total < threshold;

    const existingAlert = state.alerts.find(
      (a) => a.branchId === branch.id && !a.resolvedAt
    );

    if (isShortage) {
      const severity = total === 0 ? 'CRITICAL_ZERO' : 'LOW_STOCK';
      const shortageAmount = threshold - total;
      if (!existingAlert) {
        state.alerts.unshift({
          id: `alt-${branch.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          branchId: branch.id,
          branchName: branch.name,
          currentStock: total,
          minThreshold: threshold,
          shortageAmount,
          maleBalance: branch.inventory.male.onHand,
          femaleBalance: branch.inventory.female.onHand,
          kidsBalance: branch.inventory.kids.onHand,
          severity,
          detectedAt: now,
          acknowledged: false,
          recommendedAction:
            total === 0
              ? 'Urgent: Branch is out of stock. Create priority transfer order immediately.'
              : `Stock is below threshold (${total}/${threshold}). Restock ${shortageAmount}+ frames.`,
        });
      } else {
        existingAlert.currentStock = total;
        existingAlert.shortageAmount = shortageAmount;
        existingAlert.severity = severity;
        existingAlert.maleBalance = branch.inventory.male.onHand;
        existingAlert.femaleBalance = branch.inventory.female.onHand;
        existingAlert.kidsBalance = branch.inventory.kids.onHand;
      }
    } else {
      if (existingAlert) {
        existingAlert.resolvedAt = now;
      }
    }
  });
}

// Authentication & Role Authorization Middleware
interface AuthRequest extends express.Request {
  userRole?: string;
  userEmail?: string;
  userId?: string;
}

function authenticate(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const role = (req.headers['x-user-role'] as string) || req.body?.actorRole || 'RECEPTIONIST';
  const email = (req.headers['x-user-email'] as string) || req.body?.actorEmail || '';
  const userId = (req.headers['x-user-id'] as string) || '';

  req.userRole = role.toUpperCase();
  req.userEmail = email;
  req.userId = userId;
  next();
}

function requireAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const isAdminRole = req.userRole === 'ADMIN';
  const isAdminEmail = req.userEmail === 'oram67672@gmail.com';

  if (!isAdminRole && !isAdminEmail) {
    return res.status(403).json({
      success: false,
      error: 'Access Denied: Action requires Administrator privileges.',
    });
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);

  // Initialize DB
  loadDatabase();

  // API Endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Eyekart Eyewear Stock Management API',
      time: new Date().toISOString(),
      timezone: 'Africa/Nairobi',
      totalBranches: dbState?.branches.length || 0,
    });
  });

  // GET /api/branches
  app.get('/api/branches', (req, res) => {
    const state = loadDatabase();
    res.json({
      success: true,
      branches: state.branches,
      totalCount: state.branches.length,
    });
  });

  // GET /api/branches/:id
  app.get('/api/branches/:id', (req, res) => {
    const state = loadDatabase();
    const branch = state.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    const branchOrders = state.orders.filter((o) => o.branchId === branch.id);
    const branchMovements = state.movements.filter((m) => m.branchId === branch.id);
    const branchAlerts = state.alerts.filter((a) => a.branchId === branch.id);
    res.json({
      success: true,
      branch,
      orders: branchOrders,
      movements: branchMovements,
      alerts: branchAlerts,
    });
  });

  // POST /api/branches (Admin only, with duplicate detection)
  app.post('/api/branches', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const { name, minThreshold = 50, remarks = 'MIX Metals &Plast', allowDuplicateOverride } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name is required.' });
    }

    const normalizedNew = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const duplicate = state.branches.find(
      (b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedNew
    );

    if (duplicate && !allowDuplicateOverride) {
      return res.status(409).json({
        success: false,
        isDuplicateConflict: true,
        error: `Potential duplicate detected with existing branch '${duplicate.name}'. Administrator override required.`,
        existingBranch: duplicate,
      });
    }

    const nextSrn = Math.max(...state.branches.map((b) => b.srn), 0) + 1;
    const now = new Date().toISOString();
    const newBranch: Branch = {
      id: `br-${nextSrn.toString().padStart(3, '0')}`,
      srn: nextSrn,
      name: name.trim(),
      originalName: name.trim(),
      hasNameAnomaly: false,
      isVerified: true,
      remarks: remarks.trim(),
      minThreshold: Number(minThreshold) || 50,
      status: 'OUT_OF_STOCK',
      isActive: true,
      inventory: {
        male: { onHand: 0, reserved: 0, available: 0, pendingRequested: 0, approved: 0, dispatched: 0, received: 0 },
        female: { onHand: 0, reserved: 0, available: 0, pendingRequested: 0, approved: 0, dispatched: 0, received: 0 },
        kids: { onHand: 0, reserved: 0, available: 0, pendingRequested: 0, approved: 0, dispatched: 0, received: 0 },
        totalOnHand: 0,
        totalAvailable: 0,
        totalPendingRequested: 0,
        totalDispatched: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    state.branches.push(newBranch);
    syncAlerts(state);

    state.movements.unshift({
      id: `mvt-${Date.now()}`,
      timestamp: now,
      branchId: newBranch.id,
      branchName: newBranch.name,
      movementType: 'MANUAL_ADJUSTMENT',
      category: 'all',
      previousOnHand: 0,
      quantityChanged: 0,
      resultingOnHand: 0,
      maleChanged: 0,
      femaleChanged: 0,
      kidsChanged: 0,
      previousCategoryOnHand: { male: 0, female: 0, kids: 0 },
      resultingCategoryOnHand: { male: 0, female: 0, kids: 0 },
      actor: req.body.actor || 'Administrator',
      reason: `New branch '${newBranch.name}' created`,
    });

    await persistDb();
    res.json({ success: true, branch: newBranch });
  });

  // PUT /api/branches/:id (Admin only)
  app.put('/api/branches/:id', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const branch = state.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }

    const { name, minThreshold, remarks, isActive } = req.body;
    const now = new Date().toISOString();

    if (name && typeof name === 'string') {
      branch.name = name.trim();
    }
    if (minThreshold !== undefined) {
      branch.minThreshold = Math.max(1, Number(minThreshold));
      branch.status = computeStatus(branch.inventory.totalOnHand, branch.minThreshold);
    }
    if (remarks !== undefined) {
      branch.remarks = remarks;
    }
    if (isActive !== undefined) {
      branch.isActive = Boolean(isActive);
    }
    branch.updatedAt = now;

    syncAlerts(state);
    await persistDb();
    res.json({ success: true, branch });
  });

  // POST /api/branches/:id/verify-name (Admin only)
  app.post('/api/branches/:id/verify-name', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const branch = state.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }

    const newName = req.body.canonicalName || branch.name.replace(/B\d+:\w+\d+/g, '').trim();
    branch.name = newName;
    branch.hasNameAnomaly = false;
    branch.isVerified = true;
    branch.updatedAt = new Date().toISOString();

    const valIssue = state.validationIssues.find((v) => v.branchId === branch.id);
    if (valIssue) {
      valIssue.status = 'RESOLVED';
      valIssue.severity = 'RESOLVED';
    }

    await persistDb();
    res.json({ success: true, branch });
  });

  // POST /api/branches/:id/stock (Receptionist & Admin - quick stock adjustment with audit)
  app.post('/api/branches/:id/stock', async (req, res) => {
    const state = loadDatabase();
    const branch = state.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Counter / Branch not found' });
    }

    const { male, female, kids, note, actor = 'Sarah Wanjiku' } = req.body;

    const m = Math.max(0, parseInt(male ?? branch.inventory.male.onHand, 10));
    const f = Math.max(0, parseInt(female ?? branch.inventory.female.onHand, 10));
    const k = Math.max(0, parseInt(kids ?? branch.inventory.kids.onHand, 10));

    if (isNaN(m) || isNaN(f) || isNaN(k)) {
      return res.status(400).json({ success: false, error: 'Invalid frame quantities provided. Values must be numbers.' });
    }

    const prevCategoryOnHand = {
      male: branch.inventory.male.onHand,
      female: branch.inventory.female.onHand,
      kids: branch.inventory.kids.onHand,
    };

    const diffMale = m - prevCategoryOnHand.male;
    const diffFemale = f - prevCategoryOnHand.female;
    const diffKids = k - prevCategoryOnHand.kids;

    const now = new Date().toISOString();

    // Update branch balances
    branch.inventory.male.onHand = m;
    branch.inventory.male.available = Math.max(0, m - branch.inventory.male.reserved);
    branch.inventory.female.onHand = f;
    branch.inventory.female.available = Math.max(0, f - branch.inventory.female.reserved);
    branch.inventory.kids.onHand = k;
    branch.inventory.kids.available = Math.max(0, k - branch.inventory.kids.reserved);
    branch.inventory.totalOnHand = m + f + k;
    branch.inventory.totalAvailable = branch.inventory.totalOnHand;
    branch.status = computeStatus(branch.inventory.totalOnHand, branch.minThreshold);
    branch.lastStockMovementAt = now;
    branch.updatedAt = now;

    // Log movements for each category changed
    const categories: Array<{ name: 'male' | 'female' | 'kids'; diff: number; prev: number; curr: number }> = [
      { name: 'male', diff: diffMale, prev: prevCategoryOnHand.male, curr: m },
      { name: 'female', diff: diffFemale, prev: prevCategoryOnHand.female, curr: f },
      { name: 'kids', diff: diffKids, prev: prevCategoryOnHand.kids, curr: k },
    ];

    const loggedMovements: StockMovement[] = [];

    categories.forEach((cat) => {
      if (cat.diff !== 0) {
        const catLabel = cat.name === 'male' ? 'Male' : cat.name === 'female' ? 'Female' : 'Kids';
        const mvt: StockMovement = {
          id: `mvt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          branchId: branch.id,
          branchName: branch.name,
          movementType: 'MANUAL_ADJUSTMENT',
          category: cat.name,
          previousOnHand: cat.prev,
          quantityChanged: cat.diff,
          resultingOnHand: cat.curr,
          maleChanged: cat.name === 'male' ? cat.diff : 0,
          femaleChanged: cat.name === 'female' ? cat.diff : 0,
          kidsChanged: cat.name === 'kids' ? cat.diff : 0,
          previousCategoryOnHand: prevCategoryOnHand,
          resultingCategoryOnHand: {
            male: m,
            female: f,
            kids: k,
          },
          actor,
          reason: note && note.trim()
            ? `${note.trim()} (${cat.diff > 0 ? '+' : ''}${cat.diff} ${catLabel})`
            : `Counter stock adjusted: ${cat.diff > 0 ? '+' : ''}${cat.diff} ${catLabel} frames`,
        };
        state.movements.unshift(mvt);
        loggedMovements.push(mvt);
      }
    });

    syncAlerts(state);
    await persistDb();

    res.json({
      success: true,
      branch,
      movements: loggedMovements,
      message: 'Stock updated successfully',
    });
  });

  // GET /api/orders
  app.get('/api/orders', (req, res) => {
    const state = loadDatabase();
    res.json({
      success: true,
      orders: state.orders,
    });
  });

  // POST /api/orders (Create order - with idempotency and duplicate check)
  app.post('/api/orders', async (req, res) => {
    const state = loadDatabase();
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      return res.status(cached.status).json(cached.body);
    }

    const { branchId, male = 0, female = 0, kids = 0, remarks = '', isSubmit = false, actor = 'Sarah Wanjiku', actorRole = 'RECEPTIONIST' } = req.body;

    const branch = state.branches.find((b) => b.id === branchId);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }

    const m = Math.max(0, parseInt(male, 10) || 0);
    const f = Math.max(0, parseInt(female, 10) || 0);
    const k = Math.max(0, parseInt(kids, 10) || 0);
    const total = m + f + k;

    if (total <= 0) {
      return res.status(400).json({ success: false, error: 'Cannot create an order with 0 total frames.' });
    }

    // Duplicate submission guard (same branch, same quantities submitted within 5 seconds)
    const fiveSecsAgo = Date.now() - 5000;
    const recentDuplicate = state.orders.find(
      (o) =>
        o.branchId === branch.id &&
        o.requestedItems.male === m &&
        o.requestedItems.female === f &&
        o.requestedItems.kids === k &&
        new Date(o.createdAt).getTime() > fiveSecsAgo
    );
    if (recentDuplicate) {
      return res.json({ success: true, order: recentDuplicate, branch, isDuplicateIgnored: true });
    }

    const now = new Date().toISOString();
    const orderIndex = state.orders.length + 1;
    const yearMonth = now.slice(0, 7).replace('-', '');
    const orderNumber = `EYE-ORD-${yearMonth}-${orderIndex.toString().padStart(4, '0')}`;

    const status = isSubmit ? 'SUBMITTED' : 'DRAFT';

    const newOrder: Order = {
      id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orderNumber,
      branchId: branch.id,
      branchName: branch.name,
      status,
      requestedItems: { male: m, female: f, kids: k, total },
      requestedBy: actor,
      requestedByRole: actorRole,
      remarks: remarks.trim(),
      timeline: [
        {
          status,
          timestamp: now,
          actor,
          notes: isSubmit ? 'Order submitted by receptionist for approval.' : 'Order saved as draft.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    if (isSubmit) {
      // Update pending requested on branch
      branch.inventory.male.pendingRequested += m;
      branch.inventory.female.pendingRequested += f;
      branch.inventory.kids.pendingRequested += k;
      branch.inventory.totalPendingRequested =
        branch.inventory.male.pendingRequested +
        branch.inventory.female.pendingRequested +
        branch.inventory.kids.pendingRequested;
    }

    state.orders.unshift(newOrder);

    state.movements.unshift({
      id: `mvt-${Date.now()}`,
      timestamp: now,
      branchId: branch.id,
      branchName: branch.name,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      movementType: 'ORDER_ALLOCATION',
      category: 'all',
      previousOnHand: branch.inventory.totalOnHand,
      quantityChanged: 0,
      resultingOnHand: branch.inventory.totalOnHand,
      maleChanged: 0,
      femaleChanged: 0,
      kidsChanged: 0,
      previousCategoryOnHand: {
        male: branch.inventory.male.onHand,
        female: branch.inventory.female.onHand,
        kids: branch.inventory.kids.onHand,
      },
      resultingCategoryOnHand: {
        male: branch.inventory.male.onHand,
        female: branch.inventory.female.onHand,
        kids: branch.inventory.kids.onHand,
      },
      actor,
      reason: `${status} order ${orderNumber} created for ${total} frames (M:${m}, F:${f}, K:${k})`,
    });

    await persistDb();
    const responsePayload = { success: true, order: newOrder, branch };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        status: 200,
        body: responsePayload,
        timestamp: Date.now(),
      });
    }

    res.json(responsePayload);
  });

  // POST /api/orders/:id/submit
  app.post('/api/orders/:id/submit', async (req, res) => {
    const state = loadDatabase();
    const order = state.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'DRAFT') {
      return res.status(400).json({ success: false, error: `Only draft orders can be submitted (current status: ${order.status})` });
    }

    const branch = state.branches.find((b) => b.id === order.branchId);
    if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });

    const now = new Date().toISOString();
    const actor = req.body.actor || 'Sarah Wanjiku';

    order.status = 'SUBMITTED';
    order.updatedAt = now;
    order.timeline.push({
      status: 'SUBMITTED',
      timestamp: now,
      actor,
      notes: 'Draft submitted for approval',
    });

    branch.inventory.male.pendingRequested += order.requestedItems.male;
    branch.inventory.female.pendingRequested += order.requestedItems.female;
    branch.inventory.kids.pendingRequested += order.requestedItems.kids;
    branch.inventory.totalPendingRequested =
      branch.inventory.male.pendingRequested +
      branch.inventory.female.pendingRequested +
      branch.inventory.kids.pendingRequested;

    await persistDb();
    res.json({ success: true, order, branch });
  });

  // POST /api/orders/:id/approve (Admin only)
  app.post('/api/orders/:id/approve', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const orderId = req.params.id;

    if (orderOperationLocks.has(orderId)) {
      return res.status(409).json({ success: false, error: 'Concurrent order operation in progress. Please retry.' });
    }
    orderOperationLocks.add(orderId);

    try {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
      if (order.status === 'APPROVED') {
        return res.status(409).json({ success: false, error: 'Order has already been approved.' });
      }
      if (order.status !== 'SUBMITTED') {
        return res.status(400).json({ success: false, error: `Only submitted orders can be approved (current status: ${order.status})` });
      }

      const branch = state.branches.find((b) => b.id === order.branchId);
      if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });

      const { approvedMale, approvedFemale, approvedKids, actor = 'David Kiprop' } = req.body;
      const now = new Date().toISOString();

      const m = approvedMale !== undefined ? Math.max(0, parseInt(approvedMale, 10)) : order.requestedItems.male;
      const f = approvedFemale !== undefined ? Math.max(0, parseInt(approvedFemale, 10)) : order.requestedItems.female;
      const k = approvedKids !== undefined ? Math.max(0, parseInt(approvedKids, 10)) : order.requestedItems.kids;

      order.approvedItems = { male: m, female: f, kids: k, total: m + f + k };
      order.approvedBy = actor;
      order.status = 'APPROVED';
      order.updatedAt = now;
      order.timeline.push({
        status: 'APPROVED',
        timestamp: now,
        actor,
        notes: `Approved for ${order.approvedItems.total} frames.`,
      });

      // Transfer from pendingRequested to approved
      branch.inventory.male.pendingRequested = Math.max(0, branch.inventory.male.pendingRequested - order.requestedItems.male);
      branch.inventory.female.pendingRequested = Math.max(0, branch.inventory.female.pendingRequested - order.requestedItems.female);
      branch.inventory.kids.pendingRequested = Math.max(0, branch.inventory.kids.pendingRequested - order.requestedItems.kids);
      branch.inventory.male.approved += m;
      branch.inventory.female.approved += f;
      branch.inventory.kids.approved += k;
      branch.inventory.totalPendingRequested =
        branch.inventory.male.pendingRequested +
        branch.inventory.female.pendingRequested +
        branch.inventory.kids.pendingRequested;

      await persistDb();
      res.json({ success: true, order, branch });
    } finally {
      orderOperationLocks.delete(orderId);
    }
  });

  // POST /api/orders/:id/dispatch (Admin/Warehouse only)
  app.post('/api/orders/:id/dispatch', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const orderId = req.params.id;

    if (orderOperationLocks.has(orderId)) {
      return res.status(409).json({ success: false, error: 'Concurrent dispatch in progress. Please retry.' });
    }
    orderOperationLocks.add(orderId);

    try {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
      if (order.status === 'DISPATCHED') {
        return res.status(409).json({ success: false, error: 'Order has already been dispatched.' });
      }
      if (order.status !== 'APPROVED') {
        return res.status(400).json({ success: false, error: `Only approved orders can be dispatched (current status: ${order.status})` });
      }

      const branch = state.branches.find((b) => b.id === order.branchId);
      if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });

      const { courierRef = 'Eyekart Logistics Nairobi', dispatchedMale, dispatchedFemale, dispatchedKids, actor = 'David Kiprop' } = req.body;
      const now = new Date().toISOString();

      const m = dispatchedMale !== undefined ? Math.max(0, parseInt(dispatchedMale, 10)) : order.approvedItems?.male ?? order.requestedItems.male;
      const f = dispatchedFemale !== undefined ? Math.max(0, parseInt(dispatchedFemale, 10)) : order.approvedItems?.female ?? order.requestedItems.female;
      const k = dispatchedKids !== undefined ? Math.max(0, parseInt(dispatchedKids, 10)) : order.approvedItems?.kids ?? order.requestedItems.kids;
      const totalDispatched = m + f + k;

      // Deduct from Central Warehouse stock
      if (
        state.warehouse.maleOnHand < m ||
        state.warehouse.femaleOnHand < f ||
        state.warehouse.kidsOnHand < k
      ) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock in Central Warehouse (Available: Male ${state.warehouse.maleOnHand}, Female ${state.warehouse.femaleOnHand}, Kids ${state.warehouse.kidsOnHand})`,
        });
      }

      state.warehouse.maleOnHand -= m;
      state.warehouse.femaleOnHand -= f;
      state.warehouse.kidsOnHand -= k;
      state.warehouse.totalOnHand = state.warehouse.maleOnHand + state.warehouse.femaleOnHand + state.warehouse.kidsOnHand;

      order.dispatchedItems = { male: m, female: f, kids: k, total: totalDispatched };
      order.dispatchedBy = actor;
      order.courierRef = courierRef;
      order.status = 'DISPATCHED';
      order.updatedAt = now;
      order.timeline.push({
        status: 'DISPATCHED',
        timestamp: now,
        actor,
        notes: `Dispatched ${totalDispatched} frames via ${courierRef}`,
      });

      // Update branch balances: decrement approved, increment dispatched
      branch.inventory.male.approved = Math.max(0, branch.inventory.male.approved - (order.approvedItems?.male ?? m));
      branch.inventory.female.approved = Math.max(0, branch.inventory.female.approved - (order.approvedItems?.female ?? f));
      branch.inventory.kids.approved = Math.max(0, branch.inventory.kids.approved - (order.approvedItems?.kids ?? k));
      branch.inventory.male.dispatched += m;
      branch.inventory.female.dispatched += f;
      branch.inventory.kids.dispatched += k;
      branch.inventory.totalDispatched =
        branch.inventory.male.dispatched +
        branch.inventory.female.dispatched +
        branch.inventory.kids.dispatched;

      state.movements.unshift({
        id: `mvt-${Date.now()}`,
        timestamp: now,
        branchId: branch.id,
        branchName: branch.name,
        orderId: order.id,
        orderNumber: order.orderNumber,
        movementType: 'DISPATCH_FROM_WAREHOUSE',
        category: 'all',
        previousOnHand: branch.inventory.totalOnHand,
        quantityChanged: totalDispatched,
        resultingOnHand: branch.inventory.totalOnHand,
        maleChanged: m,
        femaleChanged: f,
        kidsChanged: k,
        previousCategoryOnHand: {
          male: branch.inventory.male.onHand,
          female: branch.inventory.female.onHand,
          kids: branch.inventory.kids.onHand,
        },
        resultingCategoryOnHand: {
          male: branch.inventory.male.onHand,
          female: branch.inventory.female.onHand,
          kids: branch.inventory.kids.onHand,
        },
        actor,
        reason: `Dispatched ${totalDispatched} frames from Central Warehouse to branch (Ref: ${courierRef})`,
      });

      await persistDb();
      res.json({ success: true, order, branch, warehouse: state.warehouse });
    } finally {
      orderOperationLocks.delete(orderId);
    }
  });

  // POST /api/orders/:id/receive (Receptionist / Branch Lead - Protected against double-counting)
  app.post('/api/orders/:id/receive', async (req, res) => {
    const state = loadDatabase();
    const orderId = req.params.id;

    if (orderOperationLocks.has(orderId)) {
      return res.status(409).json({ success: false, error: 'Concurrent receipt operation in progress. Please retry.' });
    }
    orderOperationLocks.add(orderId);

    try {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
      if (order.status === 'RECEIVED') {
        return res.status(409).json({ success: false, error: 'Order has already been received. Repeated receipt is prevented to avoid double-counting stock.' });
      }
      if (order.status !== 'DISPATCHED') {
        return res.status(400).json({ success: false, error: `Only dispatched orders can be received (current status: ${order.status})` });
      }

      const branch = state.branches.find((b) => b.id === order.branchId);
      if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });

      const { receivedMale, receivedFemale, receivedKids, actor = 'Sarah Wanjiku' } = req.body;
      const now = new Date().toISOString();

      const m = receivedMale !== undefined ? Math.max(0, parseInt(receivedMale, 10)) : order.dispatchedItems?.male ?? 0;
      const f = receivedFemale !== undefined ? Math.max(0, parseInt(receivedFemale, 10)) : order.dispatchedItems?.female ?? 0;
      const k = receivedKids !== undefined ? Math.max(0, parseInt(receivedKids, 10)) : order.dispatchedItems?.kids ?? 0;
      const totalReceived = m + f + k;

      // Validate that received does not exceed dispatched
      if (
        order.dispatchedItems &&
        (m > order.dispatchedItems.male || f > order.dispatchedItems.female || k > order.dispatchedItems.kids)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Received quantities cannot exceed dispatched quantities.',
        });
      }

      const prevTotal = branch.inventory.totalOnHand;
      const prevMale = branch.inventory.male.onHand;
      const prevFemale = branch.inventory.female.onHand;
      const prevKids = branch.inventory.kids.onHand;

      // ATOMIC RECEIPT: Update branch on-hand stock!
      branch.inventory.male.onHand += m;
      branch.inventory.male.available += m;
      branch.inventory.male.dispatched = Math.max(0, branch.inventory.male.dispatched - (order.dispatchedItems?.male ?? m));
      branch.inventory.male.received += m;

      branch.inventory.female.onHand += f;
      branch.inventory.female.available += f;
      branch.inventory.female.dispatched = Math.max(0, branch.inventory.female.dispatched - (order.dispatchedItems?.female ?? f));
      branch.inventory.female.received += f;

      branch.inventory.kids.onHand += k;
      branch.inventory.kids.available += k;
      branch.inventory.kids.dispatched = Math.max(0, branch.inventory.kids.dispatched - (order.dispatchedItems?.kids ?? k));
      branch.inventory.kids.received += k;

      branch.inventory.totalOnHand = branch.inventory.male.onHand + branch.inventory.female.onHand + branch.inventory.kids.onHand;
      branch.inventory.totalAvailable = branch.inventory.totalOnHand;
      branch.inventory.totalDispatched =
        branch.inventory.male.dispatched +
        branch.inventory.female.dispatched +
        branch.inventory.kids.dispatched;

      branch.status = computeStatus(branch.inventory.totalOnHand, branch.minThreshold);
      branch.lastStockMovementAt = now;
      branch.updatedAt = now;

      order.receivedItems = { male: m, female: f, kids: k, total: totalReceived };
      order.receivedBy = actor;
      order.status = 'RECEIVED';
      order.updatedAt = now;
      order.timeline.push({
        status: 'RECEIVED',
        timestamp: now,
        actor,
        notes: `Delivery confirmed. ${totalReceived} frames added to branch on-hand stock.`,
      });

      state.movements.unshift({
        id: `mvt-${Date.now()}`,
        timestamp: now,
        branchId: branch.id,
        branchName: branch.name,
        orderId: order.id,
        orderNumber: order.orderNumber,
        movementType: 'RECEIPT_AT_BRANCH',
        category: 'all',
        previousOnHand: prevTotal,
        quantityChanged: totalReceived,
        resultingOnHand: branch.inventory.totalOnHand,
        maleChanged: m,
        femaleChanged: f,
        kidsChanged: k,
        previousCategoryOnHand: { male: prevMale, female: prevFemale, kids: prevKids },
        resultingCategoryOnHand: {
          male: branch.inventory.male.onHand,
          female: branch.inventory.female.onHand,
          kids: branch.inventory.kids.onHand,
        },
        actor,
        reason: `Stock delivery confirmed for order ${order.orderNumber}: +${m} Male, +${f} Female, +${k} Kids`,
      });

      syncAlerts(state);
      await persistDb();
      res.json({ success: true, order, branch });
    } finally {
      orderOperationLocks.delete(orderId);
    }
  });

  // POST /api/orders/:id/reject (Admin only)
  app.post('/api/orders/:id/reject', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const order = state.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'SUBMITTED' && order.status !== 'DRAFT') {
      return res.status(400).json({ success: false, error: `Cannot reject an order in status ${order.status}` });
    }

    const branch = state.branches.find((b) => b.id === order.branchId);
    const { reason = 'Order rejected by administration', actor = 'David Kiprop' } = req.body;
    const now = new Date().toISOString();

    if (branch && order.status === 'SUBMITTED') {
      branch.inventory.male.pendingRequested = Math.max(0, branch.inventory.male.pendingRequested - order.requestedItems.male);
      branch.inventory.female.pendingRequested = Math.max(0, branch.inventory.female.pendingRequested - order.requestedItems.female);
      branch.inventory.kids.pendingRequested = Math.max(0, branch.inventory.kids.pendingRequested - order.requestedItems.kids);
      branch.inventory.totalPendingRequested =
        branch.inventory.male.pendingRequested +
        branch.inventory.female.pendingRequested +
        branch.inventory.kids.pendingRequested;
    }

    order.status = 'REJECTED';
    order.rejectedBy = actor;
    order.rejectionReason = reason;
    order.updatedAt = now;
    order.timeline.push({
      status: 'REJECTED',
      timestamp: now,
      actor,
      notes: `Rejected: ${reason}`,
    });

    await persistDb();
    res.json({ success: true, order });
  });

  // POST /api/orders/:id/cancel
  app.post('/api/orders/:id/cancel', async (req, res) => {
    const state = loadDatabase();
    const order = state.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'DRAFT' && order.status !== 'SUBMITTED') {
      return res.status(400).json({ success: false, error: `Only draft or submitted orders can be cancelled (current: ${order.status})` });
    }

    const branch = state.branches.find((b) => b.id === order.branchId);
    const { reason = 'Cancelled by user', actor = 'Sarah Wanjiku' } = req.body;
    const now = new Date().toISOString();

    if (branch && order.status === 'SUBMITTED') {
      branch.inventory.male.pendingRequested = Math.max(0, branch.inventory.male.pendingRequested - order.requestedItems.male);
      branch.inventory.female.pendingRequested = Math.max(0, branch.inventory.female.pendingRequested - order.requestedItems.female);
      branch.inventory.kids.pendingRequested = Math.max(0, branch.inventory.kids.pendingRequested - order.requestedItems.kids);
      branch.inventory.totalPendingRequested =
        branch.inventory.male.pendingRequested +
        branch.inventory.female.pendingRequested +
        branch.inventory.kids.pendingRequested;
    }

    order.status = 'CANCELLED';
    order.cancellationReason = reason;
    order.updatedAt = now;
    order.timeline.push({
      status: 'CANCELLED',
      timestamp: now,
      actor,
      notes: `Cancelled: ${reason}`,
    });

    await persistDb();
    res.json({ success: true, order });
  });

  // POST /api/inventory/adjust (Admin only)
  app.post('/api/inventory/adjust', requireAdmin, async (req, res) => {
    const state = loadDatabase();
    const { branchId, category, newQuantity, reason, actor = 'David Kiprop' } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Audit reason is mandatory for manual adjustments.' });
    }

    const branch = state.branches.find((b) => b.id === branchId);
    if (!branch) return res.status(404).json({ success: false, error: 'Branch not found' });

    const cat = category as StockCategory;
    if (!['male', 'female', 'kids'].includes(cat)) {
      return res.status(400).json({ success: false, error: 'Invalid frame category. Must be male, female, or kids.' });
    }

    const qty = Math.max(0, parseInt(newQuantity, 10));
    const previousOnHand = branch.inventory.totalOnHand;
    const prevCatOnHand = branch.inventory[cat].onHand;
    const diff = qty - prevCatOnHand;
    const now = new Date().toISOString();

    const prevCategoryOnHand = {
      male: branch.inventory.male.onHand,
      female: branch.inventory.female.onHand,
      kids: branch.inventory.kids.onHand,
    };

    branch.inventory[cat].onHand = qty;
    branch.inventory[cat].available = Math.max(0, qty - branch.inventory[cat].reserved);
    branch.inventory.totalOnHand = branch.inventory.male.onHand + branch.inventory.female.onHand + branch.inventory.kids.onHand;
    branch.inventory.totalAvailable = branch.inventory.totalOnHand;
    branch.status = computeStatus(branch.inventory.totalOnHand, branch.minThreshold);
    branch.lastStockMovementAt = now;
    branch.updatedAt = now;

    state.movements.unshift({
      id: `mvt-${Date.now()}`,
      timestamp: now,
      branchId: branch.id,
      branchName: branch.name,
      movementType: 'MANUAL_ADJUSTMENT',
      category: cat,
      previousOnHand,
      quantityChanged: diff,
      resultingOnHand: branch.inventory.totalOnHand,
      maleChanged: cat === 'male' ? diff : 0,
      femaleChanged: cat === 'female' ? diff : 0,
      kidsChanged: cat === 'kids' ? diff : 0,
      previousCategoryOnHand: prevCategoryOnHand,
      resultingCategoryOnHand: {
        male: branch.inventory.male.onHand,
        female: branch.inventory.female.onHand,
        kids: branch.inventory.kids.onHand,
      },
      actor,
      reason: `Manual stock adjustment: ${reason} (${diff >= 0 ? '+' : ''}${diff} ${cat} frames)`,
    });

    syncAlerts(state);
    await persistDb();
    res.json({ success: true, branch });
  });

  // GET /api/alerts
  app.get('/api/alerts', (req, res) => {
    const state = loadDatabase();
    syncAlerts(state);
    res.json({
      success: true,
      alerts: state.alerts,
    });
  });

  // POST /api/alerts/:id/acknowledge
  app.post('/api/alerts/:id/acknowledge', async (req, res) => {
    const state = loadDatabase();
    const alert = state.alerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });

    alert.acknowledged = true;
    alert.acknowledgedBy = req.body.actor || 'Sarah Wanjiku';
    alert.acknowledgedAt = new Date().toISOString();

    await persistDb();
    res.json({ success: true, alert });
  });

  // GET /api/activity-log
  app.get('/api/activity-log', (req, res) => {
    const state = loadDatabase();
    res.json({
      success: true,
      movements: state.movements,
    });
  });

  // GET /api/validation
  app.get('/api/validation', (req, res) => {
    const state = loadDatabase();
    const totalMale = state.branches.reduce((acc, b) => acc + b.inventory.male.onHand, 0);
    const totalFemale = state.branches.reduce((acc, b) => acc + b.inventory.female.onHand, 0);
    const totalKids = state.branches.reduce((acc, b) => acc + b.inventory.kids.onHand, 0);
    const calculatedTotal = totalMale + totalFemale + totalKids;
    const reportedTotalInSheet = 3740;

    res.json({
      success: true,
      issues: state.validationIssues,
      reconciliation: {
        totalBranchesImported: state.branches.length,
        expectedBranches: 35,
        reportedSheetTotal: reportedTotalInSheet,
        calculatedTotal,
        totalMale,
        totalFemale,
        totalKids,
        discrepancy: calculatedTotal - reportedTotalInSheet,
        isReconciled: calculatedTotal === reportedTotalInSheet,
        zeroStockBranches: state.branches.filter((b) => b.inventory.totalOnHand === 0).map((b) => b.name),
        anomalousBranches: state.branches.filter((b) => b.hasNameAnomaly).map((b) => b.name),
      },
    });
  });

  // GET /api/reports/monthly (Exact Mathematical Category Reconciliation)
  app.get('/api/reports/monthly', (req, res) => {
    const state = loadDatabase();
    const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const branchFilter = req.query.branchId as string;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const periodLabel = `${monthNames[month - 1]} ${year}`;

    // Month boundary timestamps
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    let targetBranches = state.branches;
    if (branchFilter && branchFilter !== 'all') {
      targetBranches = targetBranches.filter((b) => b.id === branchFilter);
    }

    const records = targetBranches.map((branch) => {
      // Find movements for this branch that occurred strictly within the selected month
      const branchMovementsInMonth = state.movements.filter((m) => {
        const time = new Date(m.timestamp).getTime();
        return m.branchId === branch.id && time >= monthStart && time <= monthEnd;
      });

      // Sum exact category quantities for receipts within the month
      const receivedReceipts = branchMovementsInMonth.filter((m) => m.movementType === 'RECEIPT_AT_BRANCH');
      const receivedMale = receivedReceipts.reduce((sum, m) => sum + (m.maleChanged ?? 0), 0);
      const receivedFemale = receivedReceipts.reduce((sum, m) => sum + (m.femaleChanged ?? 0), 0);
      const receivedKids = receivedReceipts.reduce((sum, m) => sum + (m.kidsChanged ?? 0), 0);
      const receivedTotal = receivedMale + receivedFemale + receivedKids;

      // Sum exact category quantities for dispatches within the month
      const dispatchedMovements = branchMovementsInMonth.filter((m) => m.movementType === 'DISPATCH_FROM_WAREHOUSE');
      const dispatchedMale = dispatchedMovements.reduce((sum, m) => sum + (m.maleChanged ?? 0), 0);
      const dispatchedFemale = dispatchedMovements.reduce((sum, m) => sum + (m.femaleChanged ?? 0), 0);
      const dispatchedKids = dispatchedMovements.reduce((sum, m) => sum + (m.kidsChanged ?? 0), 0);
      const dispatchedTotal = dispatchedMale + dispatchedFemale + dispatchedKids;

      // Sum exact manual adjustments within the month
      const adjustmentMovements = branchMovementsInMonth.filter((m) => m.movementType === 'MANUAL_ADJUSTMENT');
      const adjMale = adjustmentMovements.reduce((sum, m) => sum + (m.maleChanged ?? 0), 0);
      const adjFemale = adjustmentMovements.reduce((sum, m) => sum + (m.femaleChanged ?? 0), 0);
      const adjKids = adjustmentMovements.reduce((sum, m) => sum + (m.kidsChanged ?? 0), 0);
      const adjTotal = adjMale + adjFemale + adjKids;

      // Calculate exact opening balances by calculating net movements that took place after monthStart
      const movementsSinceMonthStart = state.movements.filter((m) => {
        const time = new Date(m.timestamp).getTime();
        return m.branchId === branch.id && time >= monthStart;
      });

      const netReceiptsSinceStart = movementsSinceMonthStart.filter((m) => m.movementType === 'RECEIPT_AT_BRANCH');
      const netAdjsSinceStart = movementsSinceMonthStart.filter((m) => m.movementType === 'MANUAL_ADJUSTMENT');

      const netMaleReceivedSinceStart = netReceiptsSinceStart.reduce((sum, m) => sum + (m.maleChanged ?? 0), 0);
      const netFemaleReceivedSinceStart = netReceiptsSinceStart.reduce((sum, m) => sum + (m.femaleChanged ?? 0), 0);
      const netKidsReceivedSinceStart = netReceiptsSinceStart.reduce((sum, m) => sum + (m.kidsChanged ?? 0), 0);

      const netMaleAdjSinceStart = netAdjsSinceStart.reduce((sum, m) => sum + (m.maleChanged ?? 0), 0);
      const netFemaleAdjSinceStart = netAdjsSinceStart.reduce((sum, m) => sum + (m.femaleChanged ?? 0), 0);
      const netKidsAdjSinceStart = netAdjsSinceStart.reduce((sum, m) => sum + (m.kidsChanged ?? 0), 0);

      // Exact Opening Stock = Current Stock - Net Additions Since Month Start
      const currentMale = branch.inventory.male.onHand;
      const currentFemale = branch.inventory.female.onHand;
      const currentKids = branch.inventory.kids.onHand;

      const openingMale = Math.max(0, currentMale - netMaleReceivedSinceStart - netMaleAdjSinceStart);
      const openingFemale = Math.max(0, currentFemale - netFemaleReceivedSinceStart - netFemaleAdjSinceStart);
      const openingKids = Math.max(0, currentKids - netKidsReceivedSinceStart - netKidsAdjSinceStart);
      const openingTotal = openingMale + openingFemale + openingKids;

      // Closing Stock
      const closingMale = openingMale + receivedMale + adjMale;
      const closingFemale = openingFemale + receivedFemale + adjFemale;
      const closingKids = openingKids + receivedKids + adjKids;
      const closingTotal = closingMale + closingFemale + closingKids;

      return {
        branchId: branch.id,
        branchName: branch.name,
        openingStock: {
          male: openingMale,
          female: openingFemale,
          kids: openingKids,
          total: openingTotal,
        },
        receivedStock: {
          male: receivedMale,
          female: receivedFemale,
          kids: receivedKids,
          total: receivedTotal,
        },
        dispatchedStock: {
          male: dispatchedMale,
          female: dispatchedFemale,
          kids: dispatchedKids,
          total: dispatchedTotal,
        },
        adjustments: {
          male: adjMale,
          female: adjFemale,
          kids: adjKids,
          total: adjTotal,
        },
        closingStock: {
          male: closingMale,
          female: closingFemale,
          kids: closingKids,
          total: closingTotal,
        },
        shortageIncidents: closingTotal < branch.minThreshold ? 1 : 0,
        currentStatus: branch.status,
      };
    });

    const totals = {
      totalOpening: records.reduce((acc, r) => acc + r.openingStock.total, 0),
      totalReceived: records.reduce((acc, r) => acc + r.receivedStock.total, 0),
      totalDispatched: records.reduce((acc, r) => acc + r.dispatchedStock.total, 0),
      totalAdjustments: records.reduce((acc, r) => acc + r.adjustments.total, 0),
      totalClosing: records.reduce((acc, r) => acc + r.closingStock.total, 0),
      totalRequested: state.orders.reduce((acc, o) => acc + o.requestedItems.total, 0),
      totalApproved: state.orders.reduce((acc, o) => acc + (o.approvedItems?.total || 0), 0),
      ordersCount: state.orders.length,
      lowStockIncidentsCount: records.filter((r) => r.shortageIncidents > 0).length,
    };

    res.json({
      success: true,
      report: {
        month,
        year,
        periodLabel,
        generatedAt: new Date().toISOString(),
        generatedBy: (req.query.actor as string) || 'David Kiprop (Admin)',
        totals,
        records,
      },
    });
  });

  // GET /api/warehouse
  app.get('/api/warehouse', (req, res) => {
    const state = loadDatabase();
    res.json({
      success: true,
      warehouse: state.warehouse,
    });
  });

  // POST /api/database/reset (Admin only)
  app.post('/api/database/reset', requireAdmin, async (req, res) => {
    dbState = getInitialDbState();
    idempotencyStore.clear();
    orderOperationLocks.clear();
    await persistDb();
    res.json({
      success: true,
      message: 'Database reset to original 35 spreadsheet records successfully.',
      branchesCount: dbState.branches.length,
    });
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/*.tmp.*', '**/test/**', '**/.git/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Eyekart Server Error]:', err);
    res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
  });

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Eyekart System] Production Server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('[Eyekart System] Failed to start server:', err);
  process.exit(1);
});
