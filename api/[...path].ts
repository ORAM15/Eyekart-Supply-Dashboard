import type { IncomingMessage, ServerResponse } from 'node:http';
import { INITIAL_BRANCH_RECORDS } from '../src/data/initialBranches.ts';

const SNAPSHOT_AT = '2026-10-29T19:27:23.000Z';
const REPORTED_TOTAL = 3740;
const DEFAULT_THRESHOLD = 50;

type Seed = (typeof INITIAL_BRANCH_RECORDS)[number];

function statusFor(total: number): 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (total === 0) return 'OUT_OF_STOCK';
  if (total < DEFAULT_THRESHOLD) return 'LOW_STOCK';
  return 'HEALTHY';
}

function balance(onHand: number) {
  return {
    onHand,
    reserved: 0,
    available: onHand,
    pendingRequested: 0,
    approved: 0,
    dispatched: 0,
    received: 0,
  };
}

function branchFromSeed(seed: Seed) {
  const total = seed.maleFrames + seed.femaleFrames + seed.kidsFrames;
  return {
    id: `br-${String(seed.srn).padStart(3, '0')}`,
    srn: seed.srn,
    name: seed.originalBranchName,
    originalName: seed.originalBranchName,
    hasNameAnomaly: seed.hasNameAnomaly,
    ...(seed.anomalyReason ? { anomalyReason: seed.anomalyReason } : {}),
    isVerified: !seed.hasNameAnomaly,
    remarks: seed.remarks,
    minThreshold: DEFAULT_THRESHOLD,
    status: statusFor(total),
    isActive: true,
    inventory: {
      male: balance(seed.maleFrames),
      female: balance(seed.femaleFrames),
      kids: balance(seed.kidsFrames),
      totalOnHand: total,
      totalAvailable: total,
      totalPendingRequested: 0,
      totalDispatched: 0,
    },
    createdAt: SNAPSHOT_AT,
    updatedAt: SNAPSHOT_AT,
  };
}

const branches = INITIAL_BRANCH_RECORDS.map(branchFromSeed);
const calculated = branches.reduce(
  (sum, branch) => ({
    male: sum.male + branch.inventory.male.onHand,
    female: sum.female + branch.inventory.female.onHand,
    kids: sum.kids + branch.inventory.kids.onHand,
    total: sum.total + branch.inventory.totalOnHand,
  }),
  { male: 0, female: 0, kids: 0, total: 0 },
);

const rowValidationFailed = INITIAL_BRANCH_RECORDS.some(
  (seed) => seed.maleFrames + seed.femaleFrames + seed.kidsFrames !== seed.reportedTotal,
);
const baselineIntegrityOk =
  branches.length === 35 &&
  !rowValidationFailed &&
  calculated.total === REPORTED_TOTAL &&
  calculated.male === 1500 &&
  calculated.female === 1830 &&
  calculated.kids === 410;

function makeAlerts() {
  return branches
    .filter((branch) => branch.inventory.totalOnHand < branch.minThreshold)
    .map((branch) => ({
      id: `alt-snapshot-${branch.id}`,
      branchId: branch.id,
      branchName: branch.name,
      currentStock: branch.inventory.totalOnHand,
      minThreshold: branch.minThreshold,
      shortageAmount: branch.minThreshold - branch.inventory.totalOnHand,
      maleBalance: branch.inventory.male.onHand,
      femaleBalance: branch.inventory.female.onHand,
      kidsBalance: branch.inventory.kids.onHand,
      severity: branch.inventory.totalOnHand === 0 ? 'CRITICAL_ZERO' as const : 'LOW_STOCK' as const,
      detectedAt: SNAPSHOT_AT,
      acknowledged: false,
      recommendedAction: 'Snapshot alert only. Verify current physical stock before taking action; live stock operations are disabled.',
    }));
}
const alerts = makeAlerts();

const issues = [
  {
    id: 'val-busia-anomaly',
    type: 'NAME_ANOMALY',
    title: 'Spreadsheet Artifact in Branch Name',
    description: "The screenshot displays 'Bliss BusiaB3:D27'. 'Bliss Busia' is a candidate canonical name, not a confirmed edit.",
    branchId: 'br-001',
    srn: 1,
    severity: 'WARNING',
    status: 'PENDING_REVIEW',
    resolutionAction: 'Confirm the canonical name with the business owner before editing.',
  },
  {
    id: 'val-srn-gap-3',
    type: 'SRN_GAP',
    title: 'SRN 3 absent from the source list',
    description: 'The screenshot jumps from SRN 2 to SRN 4. No branch is inferred for SRN 3.',
    srn: 3,
    severity: 'INFO',
    status: 'RESOLVED',
  },
  {
    id: 'val-srn-gap-35',
    type: 'SRN_GAP',
    title: 'SRN 35 absent from the source list',
    description: 'The screenshot jumps from SRN 34 to SRN 36. No branch is inferred for SRN 35.',
    srn: 35,
    severity: 'INFO',
    status: 'RESOLVED',
  },
  {
    id: 'val-total-check',
    type: 'TOTAL_CHECK',
    title: 'Screenshot total reconciled',
    description: 'All 35 displayed source rows sum to 3,740 frames: Male 1,500; Female 1,830; Kids 410.',
    severity: 'INFO',
    status: 'RESOLVED',
  },
  {
    id: 'val-zero-stock-branches',
    type: 'ZERO_STOCK',
    title: 'Four branches are highlighted with zero stock',
    description: 'The screenshot shows Bliss Diani, Bliss Iten, Bliss Ol Kalou, and Bliss Rongai at zero stock.',
    severity: 'WARNING',
    status: 'RESOLVED',
  },
  {
    id: 'val-siaya-kids-zero',
    type: 'CATEGORY_ZERO',
    title: 'Bliss Siaya has zero Kids frames',
    description: 'The screenshot shows 40 Male, 50 Female, 0 Kids, total 90.',
    branchId: 'br-030',
    srn: 30,
    severity: 'INFO',
    status: 'RESOLVED',
  },
];

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function itemQuantities(branch: (typeof branches)[number]) {
  return {
    male: branch.inventory.male.onHand,
    female: branch.inventory.female.onHand,
    kids: branch.inventory.kids.onHand,
    total: branch.inventory.totalOnHand,
  };
}

function monthlyReport(month: number, year: number, branchId?: string) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const selected = branchId && branchId !== 'all'
    ? branches.filter((branch) => branch.id === branchId)
    : branches;
  const zeroFlows = { male: 0, female: 0, kids: 0, total: 0 };
  const records = selected.map((branch) => ({
    branchId: branch.id,
    branchName: branch.name,
    openingStock: itemQuantities(branch),
    receivedStock: { ...zeroFlows },
    dispatchedStock: { ...zeroFlows },
    adjustments: { ...zeroFlows },
    closingStock: itemQuantities(branch),
    shortageIncidents: branch.inventory.totalOnHand < branch.minThreshold ? 1 : 0,
    currentStatus: branch.status,
  }));
  const totals = {
    totalOpening: records.reduce((s, r) => s + r.openingStock.total, 0),
    totalReceived: 0,
    totalDispatched: 0,
    totalAdjustments: 0,
    totalClosing: records.reduce((s, r) => s + r.closingStock.total, 0),
    totalRequested: 0,
    totalApproved: 0,
    ordersCount: 0,
    lowStockIncidentsCount: records.filter((r) => r.shortageIncidents > 0).length,
  };
  return {
    month,
    year,
    periodLabel: monthNames[month - 1] + ' ' + year,
    generatedAt: SNAPSHOT_AT,
    generatedBy: 'Read-only screenshot baseline',
    totals,
    records,
  };
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'https://eyekart.invalid');
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 503, {
      success: false,
      code: 'READ_ONLY_SNAPSHOT',
      error: 'This Vercel API is a read-only snapshot. No change was saved. Configure verified authentication and durable database storage before enabling stock, order, or admin operations.',
    });
    return;
  }

  if (!baselineIntegrityOk) {
    json(res, 500, {
      success: false,
      code: 'BASELINE_INTEGRITY_FAILED',
      error: 'The source stock baseline failed its row-total or category-total integrity checks. Data has not been served.',
    });
    return;
  }

  if (path === 'health') {
    json(res, 200, {
      status: 'ok',
      service: 'EyeKart read-only inventory snapshot API',
      mode: 'READ_ONLY_SNAPSHOT',
      time: SNAPSHOT_AT,
      timezone: 'Africa/Nairobi',
      totalBranches: branches.length,
      stockTotal: calculated.total,
      databaseConfigured: false,
      writesEnabled: false,
    });
    return;
  }

  if (path === 'branches') {
    json(res, 200, { success: true, branches, totalCount: branches.length, mode: 'READ_ONLY_SNAPSHOT' });
    return;
  }

  const branchMatch = path.match(/^branches\/([^/]+)$/);
  if (branchMatch) {
    const id = decodeURIComponent(branchMatch[1]);
    const branch = branches.find((candidate) => candidate.id === id || String(candidate.srn) === id);
    if (!branch) {
      json(res, 404, { success: false, error: 'Branch not found' });
      return;
    }
    json(res, 200, {
      success: true,
      branch,
      orders: [],
      movements: [],
      alerts: alerts.filter((alert) => alert.branchId === branch.id),
      mode: 'READ_ONLY_SNAPSHOT',
    });
    return;
  }

  if (path === 'orders') {
    json(res, 200, { success: true, orders: [], mode: 'READ_ONLY_SNAPSHOT' });
    return;
  }

  if (path === 'alerts') {
    json(res, 200, { success: true, alerts, mode: 'READ_ONLY_SNAPSHOT' });
    return;
  }

  if (path === 'activity-log') {
    json(res, 200, { success: true, movements: [], mode: 'READ_ONLY_SNAPSHOT' });
    return;
  }

  if (path === 'validation') {
    json(res, 200, {
      success: true,
      issues,
      reconciliation: {
        totalBranchesImported: branches.length,
        expectedBranches: INITIAL_BRANCH_RECORDS.length,
        reportedSheetTotal: REPORTED_TOTAL,
        calculatedTotal: calculated.total,
        totalMale: calculated.male,
        totalFemale: calculated.female,
        totalKids: calculated.kids,
        discrepancy: calculated.total - REPORTED_TOTAL,
        isReconciled: calculated.total === REPORTED_TOTAL,
        zeroStockBranches: branches.filter((branch) => branch.inventory.totalOnHand === 0).map((branch) => branch.name),
        anomalousBranches: branches.filter((branch) => branch.hasNameAnomaly).map((branch) => branch.name),
      },
      mode: 'READ_ONLY_SNAPSHOT',
    });
    return;
  }

  if (path === 'warehouse') {
    json(res, 200, {
      success: true,
      warehouse: null,
      mode: 'READ_ONLY_SNAPSHOT',
      notice: 'Warehouse inventory is not verified by the screenshot source and is intentionally not estimated.',
    });
    return;
  }

  if (path === 'reports/monthly') {
    const now = new Date();
    const parsedMonth = Number.parseInt(url.searchParams.get('month') || '', 10);
    const parsedYear = Number.parseInt(url.searchParams.get('year') || '', 10);
    const month = Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getUTCMonth() + 1;
    const year = Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getUTCFullYear();
    json(res, 200, {
      success: true,
      report: monthlyReport(month, year, url.searchParams.get('branchId') || undefined),
      mode: 'READ_ONLY_SNAPSHOT',
      notice: 'This is a baseline-only report; no transactional history is available.',
    });
    return;
  }

  json(res, 404, { success: false, error: 'API endpoint not found', path });
}
