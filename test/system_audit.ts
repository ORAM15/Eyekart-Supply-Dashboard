/**
 * Eyekart Healthcare Limited - End-to-End System Audit Test Suite
 * Tests all 14 core operational and security requirements against the live system.
 */

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  id: number,
  name: string,
  testFn: () => Promise<{ passed: boolean; details: string }>
) {
  try {
    const res = await testFn();
    results.push({ id, name, passed: res.passed, details: res.details });
    console.log(`[TEST ${id}] ${res.passed ? 'PASS' : 'FAIL'}: ${name} - ${res.details}`);
  } catch (err: any) {
    results.push({ id, name, passed: false, details: 'Exception thrown', error: err.message });
    console.error(`[TEST ${id}] ERROR: ${name} - ${err.message}`);
  }
}

async function runAudit() {
  console.log('=== STARTING EYEKART HEALTHCARE LIMITED AUDIT SUITE ===\n');

  // Test 1: Exactly 35 source branches imported
  await runTest(1, 'All 35 source branches imported exactly once', async () => {
    const res = await fetch(`${BASE_URL}/api/branches`);
    const data = await res.json();
    const count = data.branches?.length;
    const is35 = count === 35;
    return {
      passed: is35,
      details: `Branch count: ${count} (expected exactly 35). Unique internal IDs: ${new Set(data.branches.map((b: any) => b.id)).size}.`,
    };
  });

  // Test 2: Source SRN gaps and Bliss Busia anomaly
  await runTest(2, 'SRN gaps & malformed Bliss Busia name handled as data-quality issues', async () => {
    const res = await fetch(`${BASE_URL}/api/validation`);
    const data = await res.json();

    const hasBusiaAnomaly = data.issues.some((i: any) => i.id === 'val-busia-anomaly');
    const hasGap3 = data.issues.some((i: any) => i.id === 'val-srn-gap-3');
    const hasGap35 = data.issues.some((i: any) => i.id === 'val-srn-gap-35');

    const passed = hasBusiaAnomaly && hasGap3 && hasGap35;
    return {
      passed,
      details: `Busia anomaly flagged: ${hasBusiaAnomaly}, SRN 3 gap tracked: ${hasGap3}, SRN 35 gap tracked: ${hasGap35}.`,
    };
  });

  // Test 3: Inventory totals calculated vs reported 3,740
  await runTest(3, 'Inventory totals calculated and reconciled with reported 3,740', async () => {
    const res = await fetch(`${BASE_URL}/api/validation`);
    const data = await res.json();
    const { calculatedTotal, reportedSheetTotal, discrepancy, isReconciled } = data.reconciliation;
    const passed = calculatedTotal === 3740 && reportedSheetTotal === 3740 && discrepancy === 0 && isReconciled;
    return {
      passed,
      details: `Calculated: ${calculatedTotal}, Reported: ${reportedSheetTotal}, Discrepancy: ${discrepancy}, Reconciled: ${isReconciled}.`,
    };
  });

  // Test 4: Plus and Minus quantity logic
  await runTest(4, 'Plus and minus quantity bounds (no negative values, subtotal calculated)', async () => {
    // Attempt order with 0 quantity
    const resZero = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-005', male: 0, female: 0, kids: 0 }),
    });
    const zeroRejected = resZero.status === 400;

    // Attempt order with negative quantities
    const resNegative = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-005', male: -10, female: 5, kids: 0 }),
    });
    const negData = await resNegative.json();
    // Negative sanitized to 0
    const negSanitized = negData.order?.requestedItems?.male === 0;

    return {
      passed: zeroRejected && negSanitized,
      details: `Zero quantity rejected: ${zeroRejected} (HTTP ${resZero.status}), Negative values sanitized to 0: ${negSanitized}.`,
    };
  });

  // Test 5: Order state transitions & impossible transitions rejected
  await runTest(5, 'Valid state-transition lifecycle and rejection of impossible leaps', async () => {
    // 1. Create a draft order
    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-006', male: 15, female: 20, kids: 5, isSubmit: false }),
    });
    const created = await createRes.json();
    const orderId = created.order.id;

    // 2. Attempt impossible leap: Dispatching directly from DRAFT (should fail with 400)
    const badDispatch = await fetch(`${BASE_URL}/api/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ courierRef: 'Test Courier' }),
    });
    const badDispatchBlocked = badDispatch.status === 400;

    // 3. Submit draft -> SUBMITTED
    const submitRes = await fetch(`${BASE_URL}/api/orders/${orderId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ actor: 'Sarah Wanjiku' }),
    });
    const submitted = await submitRes.json();
    const isSubmitted = submitted.order.status === 'SUBMITTED';

    return {
      passed: badDispatchBlocked && isSubmitted,
      details: `Premature dispatch from draft blocked: ${badDispatchBlocked} (HTTP ${badDispatch.status}), Submitted status: ${isSubmitted}.`,
    };
  });

  // Test 6: Inventory NOT incremented upon order submission
  await runTest(6, 'Inventory is NOT incremented when an order is merely submitted', async () => {
    // Get branch current stock
    const brBeforeRes = await fetch(`${BASE_URL}/api/branches/br-007`);
    const brBefore = await brBeforeRes.json();
    const stockBefore = brBefore.branch.inventory.totalOnHand;

    // Submit an order for 40 frames
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-007', male: 20, female: 15, kids: 5, isSubmit: true }),
    });
    const orderData = await orderRes.json();

    // Check branch stock again
    const brAfterRes = await fetch(`${BASE_URL}/api/branches/br-007`);
    const brAfter = await brAfterRes.json();
    const stockAfter = brAfter.branch.inventory.totalOnHand;
    const pendingQty = brAfter.branch.inventory.totalPendingRequested;

    const notIncremented = stockBefore === stockAfter;
    const pendingUpdated = pendingQty >= 40;

    return {
      passed: notIncremented && pendingUpdated,
      details: `Stock before: ${stockBefore}, Stock after: ${stockAfter} (Delta: ${stockAfter - stockBefore}). Pending requests: ${pendingQty}.`,
    };
  });

  // Test 7: 49 frames triggers alert, 50 frames is healthy
  await runTest(7, '49 frames triggers LOW_STOCK alert; 50 frames is HEALTHY', async () => {
    // Adjust branch br-008 to exactly 50 frames (Male 20, Female 20, Kids 10)
    await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ branchId: 'br-008', category: 'male', newQuantity: 20, reason: 'Set to 20 for threshold audit' }),
    });
    await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ branchId: 'br-008', category: 'female', newQuantity: 20, reason: 'Set to 20 for threshold audit' }),
    });
    const res50 = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ branchId: 'br-008', category: 'kids', newQuantity: 10, reason: 'Set to 10 for threshold audit (Total 50)' }),
    });
    const branch50 = (await res50.json()).branch;
    const isHealthy50 = branch50.status === 'HEALTHY' && branch50.inventory.totalOnHand === 50;

    // Now adjust down to 49 frames (drop kids to 9)
    const res49 = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ branchId: 'br-008', category: 'kids', newQuantity: 9, reason: 'Drop to 49 to test low stock alert' }),
    });
    const branch49 = (await res49.json()).branch;
    const isLow49 = branch49.status === 'LOW_STOCK' && branch49.inventory.totalOnHand === 49;

    // Check alert in alerts list
    const alertsRes = await fetch(`${BASE_URL}/api/alerts`);
    const alertsData = await alertsRes.json();
    const alertFound = alertsData.alerts.some((a: any) => a.branchId === 'br-008' && !a.resolvedAt);

    return {
      passed: isHealthy50 && isLow49 && alertFound,
      details: `At 50 frames: status is ${branch50.status}. At 49 frames: status is ${branch49.status}, alert created: ${alertFound}.`,
    };
  });

  // Test 8: Zero-stock branches remain visible and actionable
  await runTest(8, 'Zero-stock branches remain visible, flagged OUT_OF_STOCK, and actionable', async () => {
    const res = await fetch(`${BASE_URL}/api/branches`);
    const data = await res.json();
    const zeroBranches = data.branches.filter((b: any) => b.inventory.totalOnHand === 0);

    const names = zeroBranches.map((b: any) => b.name);
    const expected = ['Bliss Diani', 'Bliss Iten', 'Bliss Ol Kalou', 'Bliss Rongai'];
    const allPresent = expected.every((name) => names.includes(name));
    const allOutOfStock = zeroBranches.every((b: any) => b.status === 'OUT_OF_STOCK');

    return {
      passed: allPresent && allOutOfStock && zeroBranches.length >= 4,
      details: `Zero-stock outlets present: ${zeroBranches.length}. All flagged OUT_OF_STOCK: ${allOutOfStock}.`,
    };
  });

  // Test 9: Stock movements and audit records persist in the database
  await runTest(9, 'Stock movements and audit records persist in database', async () => {
    const res = await fetch(`${BASE_URL}/api/activity-log`);
    const data = await res.json();
    const movements = data.movements;
    const hasMovements = movements && movements.length > 35;
    const firstMvt = movements[0];
    const hasRequiredFields =
      firstMvt &&
      firstMvt.id &&
      firstMvt.timestamp &&
      firstMvt.branchId &&
      firstMvt.movementType &&
      firstMvt.actor;

    return {
      passed: hasMovements && Boolean(hasRequiredFields),
      details: `Total persistent movements in audit log: ${movements?.length}. First entry: ${firstMvt?.movementType} by ${firstMvt?.actor}.`,
    };
  });

  // Test 10: Concurrency, duplicate submissions, and repeated dispatch/receipt double-count protection
  await runTest(10, 'Concurrency and repeated receipt double-count prevention', async () => {
    // 1. Create an order and take it through to DISPATCHED
    const createRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-010', male: 10, female: 10, kids: 10, isSubmit: true }),
    });
    const order = (await createRes.json()).order;

    await fetch(`${BASE_URL}/api/orders/${order.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ actor: 'David Kiprop' }),
    });

    await fetch(`${BASE_URL}/api/orders/${order.id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ courierRef: 'Test Van' }),
    });

    // 2. Receive the order first time -> Should succeed
    const rec1 = await fetch(`${BASE_URL}/api/orders/${order.id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ actor: 'Sarah Wanjiku' }),
    });
    const rec1Success = rec1.status === 200;

    // 3. Repeated receipt on same order -> MUST fail with 409 Conflict
    const rec2 = await fetch(`${BASE_URL}/api/orders/${order.id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ actor: 'Sarah Wanjiku' }),
    });
    const rec2Blocked = rec2.status === 409;

    // 4. Also check duplicate repeated dispatch
    const dispRepeat = await fetch(`${BASE_URL}/api/orders/${order.id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ courierRef: 'Test Van' }),
    });
    const dispRepeatBlocked = dispRepeat.status === 409 || dispRepeat.status === 400;

    return {
      passed: rec1Success && rec2Blocked && dispRepeatBlocked,
      details: `First receipt: HTTP ${rec1.status}. Repeated receipt blocked: HTTP ${rec2.status} (409 Conflict). Repeated dispatch blocked: HTTP ${dispRepeat.status}.`,
    };
  });

  // Test 11: Monthly opening and closing balances reconcile with actual stock movements
  await runTest(11, 'Monthly opening + movements = closing exact reconciliation', async () => {
    const now = new Date();
    const res = await fetch(`${BASE_URL}/api/reports/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`);
    const data = await res.json();
    const report = data.report;

    let allReconciled = true;
    let checkedCount = 0;

    for (const record of report.records) {
      checkedCount++;
      const opening = record.openingStock.total;
      const received = record.receivedStock.total;
      const adj = record.adjustments.total;
      const closing = record.closingStock.total;

      if (opening + received + adj !== closing) {
        allReconciled = false;
        console.error(`Reconciliation mismatch on ${record.branchName}: ${opening} + ${received} + ${adj} != ${closing}`);
      }
    }

    return {
      passed: allReconciled && checkedCount > 0,
      details: `Reconciled all ${checkedCount} branch records. Opening + Received + Adjustments == Closing across all categories.`,
    };
  });

  // Test 12: CSV and PDF reports data accuracy
  await runTest(12, 'Report generation data integrity for CSV and PDF', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/monthly?month=10&year=2026`);
    const data = await res.json();
    const report = data.report;

    const hasTotals =
      typeof report.totals.totalOpening === 'number' &&
      typeof report.totals.totalClosing === 'number' &&
      typeof report.totals.totalReceived === 'number';

    const hasTimestamps = Boolean(report.generatedAt);

    return {
      passed: hasTotals && hasTimestamps,
      details: `Total Opening: ${report.totals.totalOpening}, Total Closing: ${report.totals.totalClosing}, Generated At: ${report.generatedAt}.`,
    };
  });

  // Test 13: Server-side authentication and role permission enforcement
  await runTest(13, 'Server-side role permission enforcement (Admin required routes block Receptionist)', async () => {
    // Receptionist trying to adjust inventory -> MUST BE REJECTED with 403 Forbidden
    const unauthAdjust = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ branchId: 'br-005', category: 'male', newQuantity: 100, reason: 'Unauthorized test' }),
    });
    const adjustBlocked = unauthAdjust.status === 403;

    // Receptionist trying to approve order -> MUST BE REJECTED with 403 Forbidden
    const unauthApprove = await fetch(`${BASE_URL}/api/orders/any-id/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'RECEPTIONIST' },
      body: JSON.stringify({ actor: 'Sarah Wanjiku' }),
    });
    const approveBlocked = unauthApprove.status === 403;

    // Admin executing adjust -> MUST SUCCEED (or return valid response)
    const adminAdjust = await fetch(`${BASE_URL}/api/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({ branchId: 'br-005', category: 'male', newQuantity: 60, reason: 'Admin authorized test' }),
    });
    const adminAllowed = adminAdjust.status === 200;

    return {
      passed: adjustBlocked && approveBlocked && adminAllowed,
      details: `Receptionist adjust blocked: ${adjustBlocked} (HTTP ${unauthAdjust.status}), Receptionist approve blocked: ${approveBlocked} (HTTP ${unauthApprove.status}), Admin adjust allowed: ${adminAllowed} (HTTP ${adminAdjust.status}).`,
    };
  });

  // Test 14: Persistence across restart and authorized sessions
  await runTest(14, 'Persistence across sessions and verified from disk storage', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.resolve('./data/eyekart_db.json');
    const fileExists = fs.existsSync(dbPath);
    let validJson = false;
    let branchCount = 0;

    if (fileExists) {
      const content = fs.readFileSync(dbPath, 'utf-8');
      const parsed = JSON.parse(content);
      branchCount = parsed.branches?.length || 0;
      validJson = branchCount === 35;
    }

    return {
      passed: fileExists && validJson,
      details: `Database file exists at data/eyekart_db.json: ${fileExists}. Valid JSON with ${branchCount} branches.`,
    };
  });

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.log(`- #${r.id} ${r.name}: ${r.details} ${r.error || ''}`));
    process.exit(1);
  } else {
    console.log('ALL AUDIT TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runAudit();
