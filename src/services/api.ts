import type {
  Branch,
  Order,
  StockMovement,
  StockAlert,
  MonthlyReportData,
  WarehouseInventory,
  ValidationIssue,
  StockCategory,
} from '../types/index.js';

const API_BASE = '/api';

export interface ValidationSummaryResponse {
  success: boolean;
  issues: ValidationIssue[];
  reconciliation: {
    totalBranchesImported: number;
    expectedBranches: number;
    reportedSheetTotal: number;
    calculatedTotal: number;
    totalMale: number;
    totalFemale: number;
    totalKids: number;
    discrepancy: number;
    isReconciled: boolean;
    zeroStockBranches: string[];
    anomalousBranches: string[];
  };
}

let currentAuth = {
  role: 'RECEPTIONIST',
  userId: 'usr-sarah',
  email: 'sarah.wanjiku@eyekart.co.ke',
};

export function setApiAuth(auth: { role: string; userId: string; email: string }) {
  currentAuth = { ...auth };
}

function getHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-role': currentAuth.role,
    'x-user-id': currentAuth.userId,
    'x-user-email': currentAuth.email,
    ...(extra || {}),
  };
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`, { headers: getHeaders() });
    return res.json();
  },

  async getBranches(): Promise<{ success: boolean; branches: Branch[]; totalCount: number }> {
    const res = await fetch(`${API_BASE}/branches`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch branches');
    return res.json();
  },

  async getBranch(id: string): Promise<{
    success: boolean;
    branch: Branch;
    orders: Order[];
    movements: StockMovement[];
    alerts: StockAlert[];
  }> {
    const res = await fetch(`${API_BASE}/branches/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch branch details');
    return res.json();
  },

  async createBranch(data: {
    name: string;
    minThreshold?: number;
    remarks?: string;
    allowDuplicateOverride?: boolean;
    actor?: string;
  }): Promise<{ success: boolean; branch?: Branch; isDuplicateConflict?: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/branches`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateBranch(
    id: string,
    data: { name?: string; minThreshold?: number; remarks?: string; isActive?: boolean }
  ): Promise<{ success: boolean; branch: Branch }> {
    const res = await fetch(`${API_BASE}/branches/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update branch');
    return result;
  },

  async updateCounterStock(
    id: string,
    data: { male: number; female: number; kids: number; note?: string; actor?: string }
  ): Promise<{ success: boolean; branch: Branch; movements: StockMovement[]; message: string }> {
    const res = await fetch(`${API_BASE}/branches/${id}/stock`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update stock');
    return result;
  },

  async verifyBranchName(
    id: string,
    canonicalName?: string
  ): Promise<{ success: boolean; branch: Branch }> {
    const res = await fetch(`${API_BASE}/branches/${id}/verify-name`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ canonicalName }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to verify branch name');
    return result;
  },

  async getOrders(): Promise<{ success: boolean; orders: Order[] }> {
    const res = await fetch(`${API_BASE}/orders`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  async createOrder(data: {
    branchId: string;
    male: number;
    female: number;
    kids: number;
    remarks?: string;
    isSubmit?: boolean;
    actor: string;
    actorRole: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; order: Order; branch: Branch }> {
    const idempotencyKey = data.idempotencyKey || `ord-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: getHeaders({ 'idempotency-key': idempotencyKey }),
      body: JSON.stringify({ ...data, idempotencyKey }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create order');
    return result;
  },

  async submitOrder(id: string, actor: string): Promise<{ success: boolean; order: Order; branch: Branch }> {
    const res = await fetch(`${API_BASE}/orders/${id}/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ actor }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to submit order');
    return result;
  },

  async approveOrder(
    id: string,
    data: { approvedMale?: number; approvedFemale?: number; approvedKids?: number; actor: string }
  ): Promise<{ success: boolean; order: Order; branch: Branch }> {
    const res = await fetch(`${API_BASE}/orders/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to approve order');
    return result;
  },

  async dispatchOrder(
    id: string,
    data: {
      courierRef?: string;
      dispatchedMale?: number;
      dispatchedFemale?: number;
      dispatchedKids?: number;
      actor: string;
    }
  ): Promise<{ success: boolean; order: Order; branch: Branch; warehouse: WarehouseInventory }> {
    const res = await fetch(`${API_BASE}/orders/${id}/dispatch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to dispatch order');
    return result;
  },

  async receiveOrder(
    id: string,
    data: { receivedMale?: number; receivedFemale?: number; receivedKids?: number; actor: string; idempotencyKey?: string }
  ): Promise<{ success: boolean; order: Order; branch: Branch }> {
    const res = await fetch(`${API_BASE}/orders/${id}/receive`, {
      method: 'POST',
      headers: getHeaders(data.idempotencyKey ? { 'idempotency-key': data.idempotencyKey } : undefined),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to confirm receipt');
    return result;
  },

  async rejectOrder(
    id: string,
    data: { reason: string; actor: string }
  ): Promise<{ success: boolean; order: Order }> {
    const res = await fetch(`${API_BASE}/orders/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to reject order');
    return result;
  },

  async cancelOrder(
    id: string,
    data: { reason: string; actor: string }
  ): Promise<{ success: boolean; order: Order }> {
    const res = await fetch(`${API_BASE}/orders/${id}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to cancel order');
    return result;
  },

  async adjustInventory(data: {
    branchId: string;
    category: StockCategory;
    newQuantity: number;
    reason: string;
    actor: string;
  }): Promise<{ success: boolean; branch: Branch }> {
    const res = await fetch(`${API_BASE}/inventory/adjust`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to adjust stock');
    return result;
  },

  async getAlerts(): Promise<{ success: boolean; alerts: StockAlert[] }> {
    const res = await fetch(`${API_BASE}/alerts`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async acknowledgeAlert(
    id: string,
    actor: string
  ): Promise<{ success: boolean; alert: StockAlert }> {
    const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ actor }),
    });
    if (!res.ok) throw new Error('Failed to acknowledge alert');
    return res.json();
  },

  async getActivityLog(): Promise<{ success: boolean; movements: StockMovement[] }> {
    const res = await fetch(`${API_BASE}/activity-log`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch activity log');
    return res.json();
  },

  async getValidation(): Promise<ValidationSummaryResponse> {
    const res = await fetch(`${API_BASE}/validation`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch validation issues');
    return res.json();
  },

  async getMonthlyReport(
    month: number,
    year: number,
    branchId?: string,
    actor?: string
  ): Promise<{ success: boolean; report: MonthlyReportData }> {
    const query = new URLSearchParams({
      month: month.toString(),
      year: year.toString(),
    });
    if (branchId) query.set('branchId', branchId);
    if (actor) query.set('actor', actor);

    const res = await fetch(`${API_BASE}/reports/monthly?${query.toString()}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch monthly report');
    return res.json();
  },

  async getWarehouse(): Promise<{ success: boolean; warehouse: WarehouseInventory }> {
    const res = await fetch(`${API_BASE}/warehouse`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch warehouse stock');
    return res.json();
  },

  async resetDatabase(): Promise<{ success: boolean; message: string; branchesCount: number }> {
    const res = await fetch(`${API_BASE}/database/reset`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to reset database');
    return result;
  },
};
