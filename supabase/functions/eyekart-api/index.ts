import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const PRODUCTION_ORIGIN = "https://eyekart-supply-dashboard-s5cu.vercel.app";

const corsHeaders = (origin: string | null): Record<string, string> => ({
  ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, idempotency-key",
  "Access-Control-Max-Age": "86400",
});

function isAllowedOrigin(origin: string): boolean {
  if (origin === PRODUCTION_ORIGIN || origin === "https://eyekart-supply-dashboard-s5cu-orams-projects.vercel.app") return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      url.hostname.startsWith("eyekart-supply-dashboard-s5cu-") &&
      url.hostname.endsWith(".orams-projects.vercel.app");
  } catch {
    return false;
  }
}

function json(status: number, payload: unknown, origin: string | null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PUBLISHABLE_KEY) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "The secure inventory database is not fully configured. No change was saved.");
  }
}

const db = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function getProfile(req: Request) {
  requireConfig();
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError(401, "AUTH_REQUIRED", "Sign in with an authorized EyeKart account.");

  const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(match[1]);
  if (authError || !authData.user) {
    throw new ApiError(401, "INVALID_SESSION", "Your session is invalid or expired. Please sign in again.");
  }

  const { data: profile, error } = await db()
    .from("app_users")
    .select("id,email,display_name,role,assigned_branch_id,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) {
    console.error("app_users profile query failed", error.message);
    throw new ApiError(503, "PROFILE_LOOKUP_FAILED", "Could not verify your EyeKart access profile.");
  }
  if (!profile || !profile.is_active) {
    throw new ApiError(403, "EYEKART_ACCESS_NOT_ASSIGNED", "This authenticated account has no active EyeKart role. An administrator must provision its app_users profile.");
  }
  if (!["ADMIN", "RECEPTIONIST", "BRANCH_USER"].includes(profile.role)) {
    throw new ApiError(403, "INVALID_ROLE", "This account does not have an approved EyeKart role.");
  }
  if (profile.role === "BRANCH_USER" && !profile.assigned_branch_id) {
    throw new ApiError(403, "BRANCH_NOT_ASSIGNED", "This branch account has no assigned branch. Ask an administrator to assign one.");
  }
  return profile;
}

function requireRole(profile: any, roles: string[]) {
  if (!roles.includes(profile.role)) {
    throw new ApiError(403, "ROLE_FORBIDDEN", "Your EyeKart role is not allowed to perform this action.");
  }
}

function canAccessBranch(profile: any, branchId: string) {
  return profile.role === "ADMIN" ||
    profile.role === "RECEPTIONIST" ||
    (profile.role === "BRANCH_USER" && profile.assigned_branch_id === branchId);
}

function assertBranchAccess(profile: any, branchId: string) {
  if (!canAccessBranch(profile, branchId)) {
    throw new ApiError(403, "BRANCH_FORBIDDEN", "Your account is not assigned to this branch.");
  }
}

function quantities(value: any, label = "Quantity") {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
    throw new ApiError(400, "INVALID_QUANTITY", `${label} must be a whole number between 0 and 1,000,000.`);
  }
  return n;
}

function itemCounts(male: unknown, female: unknown, kids: unknown) {
  const m = quantities(male, "Male frames");
  const f = quantities(female, "Female frames");
  const k = quantities(kids, "Kids frames");
  return { male: m, female: f, kids: k, total: m + f + k };
}

function branchDto(row: any) {
  if (!row) return null;
  const male = Number(row.male_on_hand) || 0;
  const female = Number(row.female_on_hand) || 0;
  const kids = Number(row.kids_on_hand) || 0;
  const total = male + female + kids;
  const threshold = Number(row.min_threshold) || 50;
  const state = total === 0 ? "OUT_OF_STOCK" : total < threshold ? "LOW_STOCK" : "HEALTHY";
  const balance = (onHand: number) => ({
    onHand, reserved: 0, available: onHand, pendingRequested: 0,
    approved: 0, dispatched: 0, received: 0,
  });
  return {
    id: row.id, srn: row.srn, name: row.name, originalName: row.original_name,
    hasNameAnomaly: row.has_name_anomaly, anomalyReason: row.anomaly_reason ?? undefined,
    isVerified: row.is_verified, remarks: row.remarks, minThreshold: threshold,
    status: state, isActive: row.is_active,
    inventory: {
      male: balance(male), female: balance(female), kids: balance(kids),
      totalOnHand: total, totalAvailable: total, totalPendingRequested: 0, totalDispatched: 0,
    },
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function orderDto(row: any) {
  return {
    id: row.id, orderNumber: row.order_number, branchId: row.branch_id,
    branchName: row.branch_name, status: row.status, requestedItems: row.requested_items,
    approvedItems: row.approved_items ?? undefined, dispatchedItems: row.dispatched_items ?? undefined,
    receivedItems: row.received_items ?? undefined, requestedBy: row.requested_by,
    requestedByRole: row.requested_by_role, approvedBy: row.approved_by ?? undefined,
    dispatchedBy: row.dispatched_by ?? undefined, receivedBy: row.received_by ?? undefined,
    rejectedBy: row.rejected_by ?? undefined, rejectionReason: row.rejection_reason ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined, courierRef: row.courier_ref ?? undefined,
    remarks: row.remarks ?? undefined, timeline: row.timeline ?? [],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function movementDto(row: any) {
  return {
    id: row.id, timestamp: row.timestamp, branchId: row.branch_id, branchName: row.branch_name,
    orderId: row.order_id ?? undefined, orderNumber: row.order_number ?? undefined,
    movementType: row.movement_type, category: row.category,
    previousOnHand: row.previous_on_hand, quantityChanged: row.quantity_changed,
    resultingOnHand: row.resulting_on_hand,
    previousCategoryOnHand: row.previous_category_on_hand ?? undefined,
    resultingCategoryOnHand: row.resulting_category_on_hand ?? undefined,
    actor: row.actor_name, reason: row.reason,
  };
}

function alertDto(row: any) {
  return {
    id: row.id, branchId: row.branch_id, branchName: row.branch_name,
    currentStock: row.current_stock, minThreshold: row.min_threshold,
    shortageAmount: row.shortage_amount, maleBalance: row.male_balance,
    femaleBalance: row.female_balance, kidsBalance: row.kids_balance,
    severity: row.severity, detectedAt: row.detected_at,
    acknowledged: row.acknowledged, acknowledgedBy: row.acknowledged_by ?? undefined,
    acknowledgedAt: row.acknowledged_at ?? undefined, recommendedAction: row.recommended_action,
  };
}

function warehouseDto(row: any) {
  if (!row) return null;
  return {
    maleOnHand: row.male_on_hand, femaleOnHand: row.female_on_hand,
    kidsOnHand: row.kids_on_hand,
    totalOnHand: row.male_on_hand + row.female_on_hand + row.kids_on_hand,
    lastRestockedAt: row.last_restocked_at ?? row.updated_at,
  };
}

function monthName(month: number) {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][month - 1];
}

async function rowsFor(table: string, query?: (q: any) => any) {
  let q = db().from(table).select("*");
  if (query) q = query(q);
  const { data, error } = await q;
  if (error) {
    console.error(`DB read failed for ${table}`, error.message);
    throw new ApiError(503, "DATABASE_READ_FAILED", `Could not read ${table.replaceAll("_", " ")}.`);
  }
  return data ?? [];
}

async function oneBranch(id: string) {
  const { data, error } = await db().from("branches").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiError(503, "DATABASE_READ_FAILED", "Could not read branch details.");
  if (!data) throw new ApiError(404, "BRANCH_NOT_FOUND", "Branch not found.");
  return data;
}

async function updateAlertForBranch(branch: any) {
  const total = branch.male_on_hand + branch.female_on_hand + branch.kids_on_hand;
  const threshold = branch.min_threshold;
  if (total < threshold) {
    const payload = {
      id: `alt-${branch.id}`, branch_id: branch.id, branch_name: branch.name,
      current_stock: total, min_threshold: threshold, shortage_amount: threshold - total,
      male_balance: branch.male_on_hand, female_balance: branch.female_on_hand, kids_balance: branch.kids_on_hand,
      severity: total === 0 ? "CRITICAL_ZERO" : "LOW_STOCK", detected_at: new Date().toISOString(),
      acknowledged: false, acknowledged_by: null, acknowledged_at: null,
      recommended_action: "Re-check physical stock and arrange replenishment if required.",
    };
    const { error } = await db().from("stock_alerts").upsert(payload, { onConflict: "branch_id" });
    if (error) throw new ApiError(503, "ALERT_UPDATE_FAILED", "Stock saved, but the alert could not refresh. Reload the dashboard.");
  } else {
    const { error } = await db().from("stock_alerts").delete().eq("branch_id", branch.id);
    if (error) throw new ApiError(503, "ALERT_UPDATE_FAILED", "Stock saved, but an old alert could not be cleared. Reload the dashboard.");
  }
}

async function handleLive(req: Request, url: URL, path: string, profile: any) {
  const client = db();
  const method = req.method.toUpperCase();
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);

  if (path === "me" && method === "GET") {
    return { user: {
      id: profile.id, email: profile.email, display_name: profile.display_name,
      role: profile.role, assigned_branch_id: profile.assigned_branch_id,
      is_active: profile.is_active,
    }, mode: "LIVE_CRUD" };
  }

  if (path === "branches" && method === "GET") {
    let query = client.from("branches").select("*").eq("is_active", true).order("srn");
    if (profile.role === "BRANCH_USER") query = query.eq("id", profile.assigned_branch_id);
    const { data, error } = await query;
    if (error) throw new ApiError(503, "DATABASE_READ_FAILED", "Could not load branch inventory.");
    const branches = (data ?? []).map(branchDto);
    return { success: true, branches, totalCount: branches.length, mode: "LIVE_CRUD" };
  }

  if (segments[0] === "branches" && segments.length === 2 && method === "GET") {
    const id = segments[1];
    assertBranchAccess(profile, id);
    const row = await oneBranch(id);
    const [orderRows, movementRows, alertRows] = await Promise.all([
      rowsFor("orders", q => q.eq("branch_id", id).order("created_at", { ascending: false }).limit(50)),
      rowsFor("stock_movements", q => q.eq("branch_id", id).order("timestamp", { ascending: false }).limit(100)),
      rowsFor("stock_alerts", q => q.eq("branch_id", id)),
    ]);
    return {
      success: true, branch: branchDto(row),
      orders: orderRows.map(orderDto), movements: movementRows.map(movementDto),
      alerts: alertRows.map(alertDto), mode: "LIVE_CRUD",
    };
  }

  if (segments[0] === "branches" && segments.length === 2 && segments[1] === "stock" && method === "POST") {
    throw new ApiError(404, "BRANCH_ID_REQUIRED", "A branch identifier is required.");
  }

  if (segments[0] === "branches" && segments.length === 3 && segments[2] === "stock" && method === "POST") {
    const id = segments[1];
    assertBranchAccess(profile, id);
    requireRole(profile, ["ADMIN", "RECEPTIONIST", "BRANCH_USER"]);
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") throw new ApiError(400, "INVALID_BODY", "Send Male, Female and Kids quantities.");
    const q = itemCounts(payload.male, payload.female, payload.kids);
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (note.length < 3) throw new ApiError(400, "AUDIT_REASON_REQUIRED", "Enter a reason of at least 3 characters for the stock audit trail.");
    const { data, error } = await client.rpc("adjust_branch_stock", {
      p_branch_id: id, p_male: q.male, p_female: q.female, p_kids: q.kids,
      p_note: note, p_actor_user_id: profile.id, p_actor_name: profile.display_name, p_expected_updated_at: payload.expectedUpdatedAt ?? null,
    });
    if (error) {
      console.error("atomic stock adjustment failed", error.message);
      if (error.code === "40001" || /stock changed since/i.test(error.message)) {
        throw new ApiError(409, "STALE_STOCK_VERSION", "This counter was updated by another user after you opened it. Close and reopen the counter, review the latest quantities, and apply your change again.");
      }
      const message = /active branch not found/i.test(error.message) ? "Active branch not found."
        : /reason/i.test(error.message) ? "A valid audit reason is required."
        : /whole numbers|between 0/i.test(error.message) ? "Frame quantities must be non-negative whole numbers."
        : "Stock update failed. No partial inventory change was committed.";
      throw new ApiError(400, "STOCK_UPDATE_FAILED", message);
    }
    const row = await oneBranch(id);
    const movementRows = await rowsFor("stock_movements", q2 => q2.eq("branch_id", id).order("timestamp", { ascending: false }).limit(10));
    return {
      success: true, branch: branchDto(row), movements: movementRows.map(movementDto),
      message: "Stock saved to the live database and audit history updated.",
      mode: "LIVE_CRUD",
    };
  }

  if (segments[0] === "branches" && segments.length === 3 && segments[2] === "verify-name" && method === "POST") {
    requireRole(profile, ["ADMIN"]);
    const id = segments[1];
    const payload = await req.json().catch(() => ({}));
    const row = await oneBranch(id);
    const name = typeof payload.canonicalName === "string" && payload.canonicalName.trim()
      ? payload.canonicalName.trim() : row.name;
    const { data, error } = await client.from("branches").update({
      name, is_verified: true, has_name_anomaly: false, anomaly_reason: null, updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").single();
    if (error) throw new ApiError(503, "BRANCH_UPDATE_FAILED", "Could not save the branch name.");
    return { success: true, branch: branchDto(data), mode: "LIVE_CRUD" };
  }

  if (path === "branches" && method === "POST") {
    requireRole(profile, ["ADMIN"]);
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload.name !== "string" || !payload.name.trim()) throw new ApiError(400, "BRANCH_NAME_REQUIRED", "Branch name is required.");
    const latest = await rowsFor("branches", q => q.select("srn").order("srn", { ascending: false }).limit(1));
    const srn = Number(latest[0]?.srn ?? 0) + 1;
    const id = `br-${String(srn).padStart(3, "0")}`;
    const { data, error } = await client.from("branches").insert({
      id, srn, name: payload.name.trim(), original_name: payload.name.trim(),
      has_name_anomaly: false, anomaly_reason: null, is_verified: true,
      remarks: typeof payload.remarks === "string" ? payload.remarks.trim() : "",
      min_threshold: quantities(payload.minThreshold ?? 50, "Threshold"),
      is_active: true, male_on_hand: 0, female_on_hand: 0, kids_on_hand: 0,
    }).select("*").single();
    if (error) throw new ApiError(409, "BRANCH_CREATE_FAILED", "Could not create branch. Check whether another user created a branch at the same time.");
    return { success: true, branch: branchDto(data), mode: "LIVE_CRUD" };
  }

  if (segments[0] === "branches" && segments.length === 2 && method === "PUT") {
    requireRole(profile, ["ADMIN"]);
    const id = segments[1];
    const payload = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof payload.name === "string" && payload.name.trim()) update.name = payload.name.trim();
    if (payload.minThreshold !== undefined) update.min_threshold = quantities(payload.minThreshold, "Threshold");
    if (typeof payload.remarks === "string") update.remarks = payload.remarks.trim();
    if (typeof payload.isActive === "boolean") update.is_active = payload.isActive;
    const { data, error } = await client.from("branches").update(update).eq("id", id).select("*").maybeSingle();
    if (error || !data) throw new ApiError(404, "BRANCH_UPDATE_FAILED", "Could not update branch.");
    await updateAlertForBranch(data);
    return { success: true, branch: branchDto(data), mode: "LIVE_CRUD" };
  }

  if (segments[0] === "branches" && segments.length === 2 && method === "DELETE") {
    requireRole(profile, ["ADMIN"]);
    const id = segments[1];
    const { data, error } = await client.from("branches").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
    if (error || !data) throw new ApiError(404, "BRANCH_DELETE_FAILED", "Branch not found or could not be archived.");
    return { success: true, archivedBranchId: id, message: "Branch archived; stock and audit history were preserved.", mode: "LIVE_CRUD" };
  }

  if (path === "orders" && method === "GET") {
    let query = client.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    if (profile.role === "BRANCH_USER" && profile.assigned_branch_id) query = query.eq("branch_id", profile.assigned_branch_id);
    const { data, error } = await query;
    if (error) throw new ApiError(503, "ORDER_READ_FAILED", "Could not load orders.");
    return { success: true, orders: (data ?? []).map(orderDto), mode: "LIVE_CRUD" };
  }

  if (path === "orders" && method === "POST") {
    requireRole(profile, ["ADMIN", "RECEPTIONIST", "BRANCH_USER"]);
    const payload = await req.json().catch(() => null);
    if (!payload?.branchId) throw new ApiError(400, "BRANCH_REQUIRED", "Choose a branch for this order.");
    assertBranchAccess(profile, String(payload.branchId));
    const q = itemCounts(payload.male, payload.female, payload.kids);
    if (q.total <= 0) throw new ApiError(400, "ORDER_QUANTITY_REQUIRED", "Order quantity must be greater than zero.");
    const idem = req.headers.get("idempotency-key") || payload.idempotencyKey || null;
    if (idem) {
      const { data: prior } = await client.from("orders").select("*").eq("idempotency_key", idem).maybeSingle();
      if (prior) return { success: true, order: orderDto(prior), idempotentReplay: true, mode: "LIVE_CRUD" };
    }
    const branch = await oneBranch(String(payload.branchId));
    const now = new Date().toISOString();
    const id = `ord-${crypto.randomUUID()}`;
    const orderNumber = `EK-${now.slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
    const status = payload.isSubmit ? "SUBMITTED" : "DRAFT";
    const timeline = [{ status, timestamp: now, actor: profile.display_name, notes: payload.remarks || (status === "SUBMITTED" ? "Submitted at creation." : "Draft created.") }];
    const insert = {
      id, order_number: orderNumber, branch_id: branch.id, status,
      requested_items: q, approved_items: null, dispatched_items: null, received_items: null,
      requested_by: profile.display_name, requested_by_role: profile.role, requested_by_user_id: profile.id,
      remarks: typeof payload.remarks === "string" ? payload.remarks.trim() : "",
      timeline, idempotency_key: idem, created_at: now, updated_at: now,
    };
    const { data, error } = await client.from("orders").insert(insert).select("*").single();
    if (error) throw new ApiError(409, "ORDER_CREATE_FAILED", "Order could not be created. Please refresh and retry.");
    return { success: true, order: orderDto(data), branch: branchDto(branch), mode: "LIVE_CRUD" };
  }

  if (segments[0] === "orders" && segments.length === 3 && method === "POST") {
    const [, id, action] = segments;
    const { data: order, error: orderError } = await client.from("orders").select("*").eq("id", id).maybeSingle();
    if (orderError || !order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
    assertBranchAccess(profile, order.branch_id);
    const payload = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const timeline = Array.isArray(order.timeline) ? order.timeline.slice() : [];
    let update: Record<string, unknown> = { updated_at: now };
    if (action === "submit") {
      requireRole(profile, ["ADMIN", "RECEPTIONIST", "BRANCH_USER"]);
      if (order.status !== "DRAFT") throw new ApiError(409, "INVALID_ORDER_STATE", "Only draft orders can be submitted.");
      update.status = "SUBMITTED";
      timeline.push({ status: "SUBMITTED", timestamp: now, actor: profile.display_name });
    } else if (action === "approve") {
      requireRole(profile, ["ADMIN"]);
      if (order.status !== "SUBMITTED") throw new ApiError(409, "INVALID_ORDER_STATE", "Only submitted orders can be approved.");
      const requested = order.requested_items;
      const approved = itemCounts(payload.approvedMale ?? requested.male, payload.approvedFemale ?? requested.female, payload.approvedKids ?? requested.kids);
      if (approved.male > requested.male || approved.female > requested.female || approved.kids > requested.kids) {
        throw new ApiError(400, "APPROVAL_EXCEEDS_REQUEST", "Approved quantities cannot exceed the requested quantities.");
      }
      update.status = "APPROVED"; update.approved_items = approved; update.approved_by = profile.display_name;
      timeline.push({ status: "APPROVED", timestamp: now, actor: profile.display_name });
    } else if (action === "dispatch") {
      requireRole(profile, ["ADMIN"]);
      if (order.status !== "APPROVED") throw new ApiError(409, "INVALID_ORDER_STATE", "Only approved orders can be dispatched.");
      const approved = order.approved_items ?? order.requested_items;
      const qty = itemCounts(payload.dispatchedMale ?? approved.male, payload.dispatchedFemale ?? approved.female, payload.dispatchedKids ?? approved.kids);
      if (qty.male > approved.male || qty.female > approved.female || qty.kids > approved.kids) throw new ApiError(400, "DISPATCH_EXCEEDS_APPROVAL", "Dispatched quantities cannot exceed approved quantities.");
      const { data: warehouse } = await client.from("warehouse_inventory").select("*").eq("id", "central").maybeSingle();
      if (!warehouse) throw new ApiError(409, "WAREHOUSE_UNVERIFIED", "Warehouse stock is not configured. Verify the physical warehouse count before dispatching any order.");
      const { data: updated, error } = await client.rpc("dispatch_order_atomic", {
        p_order_id: id, p_male: qty.male, p_female: qty.female, p_kids: qty.kids,
        p_actor_user_id: profile.id, p_actor_name: profile.display_name, p_courier_ref: payload.courierRef ?? null,
      });
      if (error) throw new ApiError(409, "DISPATCH_FAILED", "Dispatch failed. Check warehouse stock and retry; no partial dispatch was committed.");
      return { success: true, order: orderDto(updated), branch: branchDto(await oneBranch(order.branch_id)), warehouse: warehouseDto((await client.from("warehouse_inventory").select("*").eq("id","central").single()).data), mode: "LIVE_CRUD" };
    } else if (action === "receive") {
      requireRole(profile, ["ADMIN", "RECEPTIONIST", "BRANCH_USER"]);
      if (order.status !== "DISPATCHED") throw new ApiError(409, "INVALID_ORDER_STATE", "Only dispatched orders can be received.");
      const dispatched = order.dispatched_items ?? order.approved_items ?? order.requested_items;
      const received = itemCounts(payload.receivedMale ?? dispatched.male, payload.receivedFemale ?? dispatched.female, payload.receivedKids ?? dispatched.kids);
      if (received.male > dispatched.male || received.female > dispatched.female || received.kids > dispatched.kids) throw new ApiError(400, "RECEIPT_EXCEEDS_DISPATCH", "Received quantities cannot exceed dispatched quantities.");
      const { data: updated, error } = await client.rpc("receive_order_atomic", {
        p_order_id: id, p_male: received.male, p_female: received.female, p_kids: received.kids,
        p_actor_user_id: profile.id, p_actor_name: profile.display_name,
      });
      if (error) throw new ApiError(409, "RECEIVE_FAILED", "Receipt failed. No partial inventory change was committed.");
      return { success: true, order: orderDto(updated), branch: branchDto(await oneBranch(order.branch_id)), mode: "LIVE_CRUD" };
    } else if (action === "reject") {
      requireRole(profile, ["ADMIN"]);
      if (!["DRAFT", "SUBMITTED"].includes(order.status)) throw new ApiError(409, "INVALID_ORDER_STATE", "Only draft or submitted orders can be rejected.");
      if (typeof payload.reason !== "string" || payload.reason.trim().length < 3) throw new ApiError(400, "REJECTION_REASON_REQUIRED", "Provide a rejection reason.");
      update.status = "REJECTED"; update.rejection_reason = payload.reason.trim(); update.rejected_by = profile.display_name;
      timeline.push({ status: "REJECTED", timestamp: now, actor: profile.display_name, notes: payload.reason.trim() });
    } else if (action === "cancel") {
      requireRole(profile, ["ADMIN", "RECEPTIONIST"]);
      if (!["DRAFT", "SUBMITTED", "APPROVED"].includes(order.status)) throw new ApiError(409, "INVALID_ORDER_STATE", "Orders that have been dispatched or received require an audited reconciliation; they cannot be cancelled here.");
      if (typeof payload.reason !== "string" || payload.reason.trim().length < 3) throw new ApiError(400, "CANCELLATION_REASON_REQUIRED", "Provide a cancellation reason.");
      update.status = "CANCELLED"; update.cancellation_reason = payload.reason.trim();
      timeline.push({ status: "CANCELLED", timestamp: now, actor: profile.display_name, notes: payload.reason.trim() });
    } else {
      throw new ApiError(404, "UNKNOWN_ORDER_ACTION", "Unknown order action.");
    }
    update.timeline = timeline;
    const { data: updated, error } = await client
      .from("orders")
      .update(update)
      .eq("id", id)
      .eq("status", order.status)
      .select("*")
      .maybeSingle();
    if (error) throw new ApiError(503, "ORDER_UPDATE_FAILED", "The order update could not be saved.");
    if (!updated) throw new ApiError(409, "STALE_ORDER_STATE", "Another user changed this order. Refresh the orders list and review its current status before retrying.");
    const branch = await oneBranch(order.branch_id);
    return { success: true, order: orderDto(updated), branch: branchDto(branch), mode: "LIVE_CRUD" };
  }

  if (path === "alerts" && method === "GET") {
    let query = client.from("stock_alerts").select("*").order("detected_at", { ascending: false });
    if (profile.role === "BRANCH_USER" && profile.assigned_branch_id) query = query.eq("branch_id", profile.assigned_branch_id);
    const { data, error } = await query;
    if (error) throw new ApiError(503, "ALERT_READ_FAILED", "Could not load stock alerts.");
    return { success: true, alerts: (data ?? []).map(alertDto), mode: "LIVE_CRUD" };
  }

  if (segments[0] === "alerts" && segments.length === 3 && segments[2] === "acknowledge" && method === "POST") {
    requireRole(profile, ["ADMIN", "RECEPTIONIST"]);
    const id = segments[1];
    const { data, error } = await client.from("stock_alerts").update({
      acknowledged: true, acknowledged_by: profile.display_name, acknowledged_at: new Date().toISOString(),
    }).eq("id", id).select("*").maybeSingle();
    if (error || !data) throw new ApiError(404, "ALERT_NOT_FOUND", "Alert not found.");
    return { success: true, alert: alertDto(data), mode: "LIVE_CRUD" };
  }

  if (path === "activity-log" && method === "GET") {
    let query = client.from("stock_movements").select("*").order("timestamp", { ascending: false }).limit(500);
    if (profile.role === "BRANCH_USER" && profile.assigned_branch_id) query = query.eq("branch_id", profile.assigned_branch_id);
    const { data, error } = await query;
    if (error) throw new ApiError(503, "MOVEMENT_READ_FAILED", "Could not load stock audit history.");
    return { success: true, movements: (data ?? []).map(movementDto), mode: "LIVE_CRUD" };
  }

  if (path === "warehouse" && method === "GET") {
    const { data, error } = await client.from("warehouse_inventory").select("*").eq("id", "central").maybeSingle();
    if (error) throw new ApiError(503, "WAREHOUSE_READ_FAILED", "Could not load warehouse inventory.");
    return { success: true, warehouse: warehouseDto(data), mode: "LIVE_CRUD", notice: data ? undefined : "Warehouse stock must be physically counted and initialized before dispatch." };
  }

  if (path === "warehouse" && (method === "PUT" || method === "POST")) {
    requireRole(profile, ["ADMIN"]);
    const payload = await req.json().catch(() => null);
    if (!payload) throw new ApiError(400, "INVALID_BODY", "Send a physical warehouse count.");
    const q = itemCounts(payload.male, payload.female, payload.kids);
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    if (note.length < 3) throw new ApiError(400, "AUDIT_REASON_REQUIRED", "A warehouse count/audit reason of at least 3 characters is required.");
    const { data, error } = await client.rpc("adjust_warehouse_stock", {
      p_male: q.male, p_female: q.female, p_kids: q.kids,
      p_note: note, p_actor_user_id: profile.id, p_actor_name: profile.display_name,
    });
    if (error) throw new ApiError(503, "WAREHOUSE_UPDATE_FAILED", "Could not save the warehouse count with its audit record.");
    return { success: true, warehouse: warehouseDto(data), mode: "LIVE_CRUD" };
  }

  if (path === "validation" && method === "GET") {
    let query = client.from("branches").select("*").eq("is_active", true);
    if (profile.role === "BRANCH_USER") query = query.eq("id", profile.assigned_branch_id);
    const { data, error } = await query;
    if (error) throw new ApiError(503, "VALIDATION_FAILED", "Could not verify inventory totals.");
    const rows = data ?? [];
    const totals = rows.reduce((s: any, b: any) => ({
      male: s.male + b.male_on_hand, female: s.female + b.female_on_hand,
      kids: s.kids + b.kids_on_hand, total: s.total + b.total_on_hand,
    }), { male: 0, female: 0, kids: 0, total: 0 });
    const issues = [
      { id: "val-busia-anomaly", type: "NAME_ANOMALY", title: "Spreadsheet Artifact in Branch Name", description: "The source shows 'Bliss BusiaB3:D27'; confirm its canonical name with the owner before changing it.", branchId: "br-001", srn: 1, severity: "WARNING", status: "PENDING_REVIEW" },
      { id: "val-srn-gap-3", type: "SRN_GAP", title: "SRN 3 absent from source", description: "The source jumps from SRN 2 to SRN 4. No branch was invented.", srn: 3, severity: "INFO", status: "RESOLVED" },
      { id: "val-srn-gap-35", type: "SRN_GAP", title: "SRN 35 absent from source", description: "The source jumps from SRN 34 to SRN 36. No branch was invented.", srn: 35, severity: "INFO", status: "RESOLVED" },
    ];
    return { success: true, issues, reconciliation: {
      totalBranchesImported: rows.length, expectedBranches: 35, reportedSheetTotal: 3740,
      calculatedTotal: totals.total, totalMale: totals.male, totalFemale: totals.female, totalKids: totals.kids,
      discrepancy: totals.total - 3740, isReconciled: totals.total === 3740,
      zeroStockBranches: rows.filter((b: any) => b.total_on_hand === 0).map((b: any) => b.name),
      anomalousBranches: rows.filter((b: any) => b.has_name_anomaly).map((b: any) => b.name),
    }, mode: "LIVE_CRUD" };
  }

  if (path === "reports/monthly" && method === "GET") {
    const month = Math.max(1, Math.min(12, Number(url.searchParams.get("month")) || new Date().getMonth() + 1));
    const year = Math.max(2000, Math.min(2100, Number(url.searchParams.get("year")) || new Date().getFullYear()));
    const branchFilter = url.searchParams.get("branchId");
    let bQuery = client.from("branches").select("*").eq("is_active", true).order("srn");
    if (branchFilter && branchFilter !== "all") {
      assertBranchAccess(profile, branchFilter);
      bQuery = bQuery.eq("id", branchFilter);
    } else if (profile.role === "BRANCH_USER" && profile.assigned_branch_id) {
      bQuery = bQuery.eq("id", profile.assigned_branch_id);
    }
    const { data: bRows, error: branchError } = await bQuery;
    if (branchError) throw new ApiError(503, "REPORT_FAILED", "Could not load branch balances.");
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();
    const [mRows, oRows] = await Promise.all([
      rowsFor("stock_movements", q => q.gte("timestamp", start).lt("timestamp", end)),
      rowsFor("orders", q => q.gte("created_at", start).lt("created_at", end)),
    ]);
    const branches = bRows ?? [];
    const movementRecords = (mRows ?? []).filter((m: any) => branches.some((b: any) => b.id === m.branch_id));
    const orderRecords = (oRows ?? []).filter((o: any) => branches.some((b: any) => b.id === o.branch_id));
    const zero = () => ({ male: 0, female: 0, kids: 0, total: 0 });
    const records = branches.map((b: any) => {
      const current = { male: b.male_on_hand, female: b.female_on_hand, kids: b.kids_on_hand, total: b.total_on_hand };
      const branchMovements = movementRecords.filter((m: any) => m.branch_id === b.id);
      const received = zero(), dispatched = zero(), adjustments = zero();
      for (const m of branchMovements) {
        const target = m.movement_type === "RECEIPT_AT_BRANCH" ? received
          : m.movement_type === "DISPATCH_FROM_WAREHOUSE" ? dispatched : adjustments;
        if (m.category === "all") {
          target.male += m.male_changed || 0; target.female += m.female_changed || 0; target.kids += m.kids_changed || 0;
        } else if (m.category === "male") target.male += m.quantity_changed;
        else if (m.category === "female") target.female += m.quantity_changed;
        else if (m.category === "kids") target.kids += m.quantity_changed;
      }
      for (const val of [received,dispatched,adjustments]) val.total = val.male + val.female + val.kids;
      const opening = { male: current.male - branchMovements.reduce((s: number,m: any)=>s+(m.category==="male"?m.quantity_changed:m.category==="all"?(m.male_changed||0):0),0),
        female: current.female - branchMovements.reduce((s: number,m: any)=>s+(m.category==="female"?m.quantity_changed:m.category==="all"?(m.female_changed||0):0),0),
        kids: current.kids - branchMovements.reduce((s: number,m: any)=>s+(m.category==="kids"?m.quantity_changed:m.category==="all"?(m.kids_changed||0):0),0) };
      const openingTotal = opening.male + opening.female + opening.kids;
      return {
        branchId: b.id, branchName: b.name,
        openingStock: { ...opening, total: openingTotal },
        receivedStock: received, dispatchedStock: dispatched, adjustments,
        closingStock: current, shortageIncidents: branchMovements.filter((m: any)=>m.resulting_on_hand < b.min_threshold).length,
        currentStatus: current.total === 0 ? "OUT_OF_STOCK" : current.total < b.min_threshold ? "LOW_STOCK" : "HEALTHY",
      };
    });
    const totals = {
      totalOpening: records.reduce((s,r)=>s+r.openingStock.total,0),
      totalReceived: records.reduce((s,r)=>s+r.receivedStock.total,0),
      totalDispatched: records.reduce((s,r)=>s+r.dispatchedStock.total,0),
      totalAdjustments: records.reduce((s,r)=>s+r.adjustments.total,0),
      totalClosing: records.reduce((s,r)=>s+r.closingStock.total,0),
      totalRequested: orderRecords.reduce((s:number,o:any)=>s+(o.requested_items?.total||0),0),
      totalApproved: orderRecords.reduce((s:number,o:any)=>s+(o.approved_items?.total||0),0),
      ordersCount: orderRecords.length,
      lowStockIncidentsCount: records.reduce((s,r)=>s+r.shortageIncidents,0),
    };
    return { success: true, report: { month,year,periodLabel:`${monthName(month)} ${year}`,generatedAt:new Date().toISOString(),generatedBy:profile.display_name,totals,records }, mode:"LIVE_CRUD" };
  }

  if (path === "inventory/adjust" && method === "POST") {
    requireRole(profile, ["ADMIN"]);
    const payload = await req.json().catch(() => null);
    if (!payload?.branchId || !["male","female","kids"].includes(payload.category)) throw new ApiError(400,"INVALID_ADJUSTMENT","Choose a branch and category.");
    const row = await oneBranch(payload.branchId);
    const current = { male: row.male_on_hand, female: row.female_on_hand, kids: row.kids_on_hand };
    const q = itemCounts(
      payload.category === "male" ? payload.newQuantity : current.male,
      payload.category === "female" ? payload.newQuantity : current.female,
      payload.category === "kids" ? payload.newQuantity : current.kids,
    );
    const note = typeof payload.reason === "string" ? payload.reason.trim() : "";
    if (note.length < 3) throw new ApiError(400,"AUDIT_REASON_REQUIRED","A reason of at least 3 characters is required.");
    const { error } = await client.rpc("adjust_branch_stock", {
      p_branch_id: row.id,p_male:q.male,p_female:q.female,p_kids:q.kids,
      p_note:note,p_actor_user_id:profile.id,p_actor_name:profile.display_name,
      p_expected_updated_at:payload.expectedUpdatedAt ?? null,
    });
    if (error) throw new ApiError(400,"STOCK_UPDATE_FAILED","Stock adjustment failed; no partial update was committed.");
    return { success:true,branch:branchDto(await oneBranch(row.id)),mode:"LIVE_CRUD" };
  }

  if (path === "database/reset" && method === "POST") {
    throw new ApiError(409,"RESET_DISABLED","Database reset is disabled in production to protect live inventory and audit history.");
  }

  throw new ApiError(404, "ROUTE_NOT_FOUND", "API endpoint not found.");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (origin && !isAllowedOrigin(origin)) return json(403, { error: "Origin not allowed." }, origin);

  const path = url.pathname.replace(/^\/functions\/v1\/eyekart-api\/?/, "").replace(/^\/+/, "").replace(/\/$/, "");
  if (path === "health" && req.method === "GET") {
    return json(200, {
      status: "ok", service: "EyeKart live inventory API", mode: "LIVE_CRUD",
      databaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_PUBLISHABLE_KEY),
      writesEnabled: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_PUBLISHABLE_KEY),
    }, origin);
  }

  try {
    const profile = await getProfile(req);
    const result = await handleLive(req, url, path, profile);
    return json(200, result, origin);
  } catch (err) {
    if (err instanceof ApiError) return json(err.status, { success: false, code: err.code, error: err.message }, origin);
    console.error("EyeKart API unexpected failure", err);
    return json(500, { success: false, code: "INTERNAL_ERROR", error: "An unexpected server error occurred. No partial stock update should be assumed." }, origin);
  }
});
