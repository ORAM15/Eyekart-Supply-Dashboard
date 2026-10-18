export type StockCategory = 'male' | 'female' | 'kids';

export type StockHealthStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface CategoryBalance {
  onHand: number;
  reserved: number;
  available: number;
  pendingRequested: number;
  approved: number;
  dispatched: number;
  received: number;
}

export interface BranchInventory {
  male: CategoryBalance;
  female: CategoryBalance;
  kids: CategoryBalance;
  totalOnHand: number;
  totalAvailable: number;
  totalPendingRequested: number;
  totalDispatched: number;
}

export interface Branch {
  id: string;
  srn: number;
  name: string;
  originalName: string;
  hasNameAnomaly: boolean;
  anomalyReason?: string;
  isVerified: boolean;
  remarks: string;
  minThreshold: number; // default 50
  status: StockHealthStatus;
  isActive: boolean;
  inventory: BranchInventory;
  createdAt: string;
  updatedAt: string;
  lastStockMovementAt?: string;
}

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OrderItemQuantities {
  male: number;
  female: number;
  kids: number;
  total: number;
}

export interface OrderTimelineEvent {
  status: OrderStatus;
  timestamp: string;
  actor: string;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  status: OrderStatus;
  requestedItems: OrderItemQuantities;
  approvedItems?: OrderItemQuantities;
  dispatchedItems?: OrderItemQuantities;
  receivedItems?: OrderItemQuantities;
  requestedBy: string;
  requestedByRole: string;
  approvedBy?: string;
  dispatchedBy?: string;
  receivedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  courierRef?: string;
  remarks?: string;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'INITIAL_IMPORT'
  | 'DISPATCH_FROM_WAREHOUSE'
  | 'RECEIPT_AT_BRANCH'
  | 'MANUAL_ADJUSTMENT'
  | 'ORDER_ALLOCATION'
  | 'ORDER_CANCELLATION';

export interface StockMovement {
  id: string;
  timestamp: string;
  branchId: string;
  branchName: string;
  orderId?: string;
  orderNumber?: string;
  movementType: MovementType;
  category: StockCategory | 'all';
  previousOnHand: number;
  quantityChanged: number;
  resultingOnHand: number;
  maleChanged?: number;
  femaleChanged?: number;
  kidsChanged?: number;
  previousCategoryOnHand?: { male: number; female: number; kids: number };
  resultingCategoryOnHand?: { male: number; female: number; kids: number };
  actor: string;
  reason: string;
}

export interface StockAlert {
  id: string;
  branchId: string;
  branchName: string;
  currentStock: number;
  minThreshold: number;
  shortageAmount: number;
  maleBalance: number;
  femaleBalance: number;
  kidsBalance: number;
  severity: 'CRITICAL_ZERO' | 'LOW_STOCK';
  detectedAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  recommendedAction: string;
}

export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'BRANCH_USER';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  assignedBranchId?: string;
}

export interface WarehouseInventory {
  maleOnHand: number;
  femaleOnHand: number;
  kidsOnHand: number;
  totalOnHand: number;
  lastRestockedAt: string;
}

export interface BranchReconciliationRecord {
  branchId: string;
  branchName: string;
  openingStock: OrderItemQuantities;
  receivedStock: OrderItemQuantities;
  dispatchedStock: OrderItemQuantities;
  adjustments: OrderItemQuantities;
  closingStock: OrderItemQuantities;
  shortageIncidents: number;
  currentStatus: StockHealthStatus;
}

export interface MonthlyReportData {
  month: number;
  year: number;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
  totals: {
    totalOpening: number;
    totalReceived: number;
    totalDispatched: number;
    totalAdjustments: number;
    totalClosing: number;
    totalRequested: number;
    totalApproved: number;
    ordersCount: number;
    lowStockIncidentsCount: number;
  };
  records: BranchReconciliationRecord[];
}

export interface ValidationIssue {
  id: string;
  type: 'NAME_ANOMALY' | 'SRN_GAP' | 'ZERO_STOCK' | 'POTENTIAL_DUPLICATE' | 'CATEGORY_ZERO' | 'TOTAL_CHECK';
  title: string;
  description: string;
  branchId?: string;
  srn?: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'RESOLVED';
  status: 'PENDING_REVIEW' | 'RESOLVED';
  resolutionAction?: string;
}
