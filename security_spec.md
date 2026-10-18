# EYEKART HEALTHCARE LIMITED — SECURITY ARCHITECTURE SPECIFICATION

## Data Invariants & Access Control Policy

1. **Role Enforcement**:
   - **Administrators**: Can approve/reject orders, adjust inventory manually, manage branch records, configure thresholds.
   - **Receptionists**: Can create orders, submit orders, view real-time branch stock, view alerts, receive dispatched orders. Cannot delete audit logs or override safety limits.
   - **Branch Users**: Can only view their assigned branch and submit requests.

2. **Inventory Stock Invariants**:
   - Stock quantities must never be negative ($quantity \ge 0$).
   - A branch request does not immediately increase branch on-hand stock.
   - Branch on-hand stock increases ONLY upon confirmed physical receipt of dispatched frames.
   - Central Warehouse stock decreases upon dispatch.
   - Minimum threshold default is 50 frames; stock $< 50$ immediately triggers a Low Stock or Zero Stock alert.
   - Exactly 50 frames is evaluated as HEALTHY.

3. **Audit Log Immutability**:
   - Movement log entries are strictly append-only. No updates or deletions are permitted by any role.

## The Dirty Dozen Security Penetration Payloads

1. **Zero-Quantity Order Injection**:
   - Attempt: Submitting `{ male: 0, female: 0, kids: 0 }`.
   - Mitigation: Blocked by backend validation (`total > 0`).

2. **Negative Stock Allocation**:
   - Attempt: Sending `{ male: -25 }` to subtract stock.
   - Mitigation: Sanitized with `Math.max(0, val)` and rejected with `400 Bad Request`.

3. **Unauthorized Order Status Skip (Draft -> Dispatched)**:
   - Attempt: Bypassing `SUBMITTED` and `APPROVED` directly to `DISPATCHED`.
   - Mitigation: Strict state machine validation prevents invalid status leaps.

4. **Receipt Exceeding Dispatched Quantity**:
   - Attempt: Claiming receipt of 150 frames when only 50 were dispatched.
   - Mitigation: Rejected by validation comparing received vs dispatched category numbers.

5. **Ghost Field Injection (Shadow Update)**:
   - Attempt: Sending `{ isAdmin: true, bypassRules: true }` in order payload.
   - Mitigation: Rejected by strict schema allowlists and server-side mapping.

6. **Unauthenticated Audit Deletion**:
   - Attempt: Issuing `DELETE /api/activity-log`.
   - Mitigation: Endpoint does not exist; Firestore security rules specify `allow delete: if false;`.

7. **Duplicate Branch Creation**:
   - Attempt: Creating "bliss diani" when "Bliss Diani" already exists.
   - Mitigation: Normalized string comparison detects and blocks duplicate creation without explicit admin override.

8. **Silent Discrepancy Masking**:
   - Attempt: Forcing sheet total to match calculated total without warning.
   - Mitigation: Validation screen compares 3,740 calculated vs 3,740 reported and displays audit status.

9. **Central Warehouse Over-Draft**:
   - Attempt: Dispatching 5,000 male frames when only 4,500 exist in warehouse.
   - Mitigation: Pre-dispatch warehouse balance check returns `400 Bad Request` if insufficient stock.

10. **Receptionist Threshold Tampering**:
    - Attempt: Non-admin calling threshold update endpoint.
    - Mitigation: Restricted to admin role.

11. **Client-Side Fake Success Spoofing**:
    - Attempt: UI claiming order saved without server HTTP 200 response.
    - Mitigation: React state only updates after successful server response.

12. **Double-Click Order Duplication**:
    - Attempt: Rapid clicking submit button causing two orders.
    - Mitigation: Confirmation modal with `submitting` lock and backend unique order sequencing.
