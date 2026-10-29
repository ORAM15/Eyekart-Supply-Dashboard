import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Branch,
  Order,
  StockMovement,
  StockAlert,
  WarehouseInventory,
  ValidationIssue,
  UserSession,
  StockCategory,
} from '../types/index.js';
import { api, setApiAuth, type ValidationSummaryResponse } from '../services/api.js';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const PRESET_USERS: UserSession[] = [
  {
    id: 'usr-sarah',
    name: 'Sarah Wanjiku',
    email: 'sarah.wanjiku@eyekart.co.ke',
    role: 'RECEPTIONIST',
    title: 'Front Desk Receptionist (Nairobi Central Counter)',
  },
  {
    id: 'usr-david',
    name: 'David Kiprop',
    email: 'oram67672@gmail.com', // Authenticated administrator
    role: 'ADMIN',
    title: 'Chief Stock Administrator & Warehouse Controller',
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

interface AppContextType {
  branches: Branch[];
  orders: Order[];
  alerts: StockAlert[];
  movements: StockMovement[];
  warehouse: WarehouseInventory | null;
  validationIssues: ValidationIssue[];
  reconciliationInfo: ValidationSummaryResponse['reconciliation'] | null;
  currentUser: UserSession;
  activeTab: string;
  selectedBranchId: string | null;
  orderDrawerOpen: boolean;
  orderPrefillBranchId: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  toasts: ToastMessage[];
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  openOrderDrawer: (branchId?: string) => void;
  closeOrderDrawer: () => void;
  setSelectedBranchId: (id: string | null) => void;
  switchUser: (user: UserSession) => void;
  showToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
  refreshData: () => Promise<void>;
  createOrder: (data: {
    branchId: string;
    male: number;
    female: number;
    kids: number;
    remarks?: string;
    isSubmit?: boolean;
  }) => Promise<Order>;
  submitOrder: (id: string) => Promise<void>;
  approveOrder: (
    id: string,
    data: { approvedMale?: number; approvedFemale?: number; approvedKids?: number }
  ) => Promise<void>;
  dispatchOrder: (
    id: string,
    data: {
      courierRef?: string;
      dispatchedMale?: number;
      dispatchedFemale?: number;
      dispatchedKids?: number;
    }
  ) => Promise<void>;
  receiveOrder: (
    id: string,
    data: { receivedMale?: number; receivedFemale?: number; receivedKids?: number }
  ) => Promise<void>;
  rejectOrder: (id: string, reason: string) => Promise<void>;
  cancelOrder: (id: string, reason: string) => Promise<void>;
  adjustStock: (
    branchId: string,
    category: StockCategory,
    newQuantity: number,
    reason: string
  ) => Promise<void>;
  updateBranchThreshold: (branchId: string, minThreshold: number) => Promise<void>;
  verifyBranchName: (branchId: string, canonicalName?: string) => Promise<void>;
  createBranch: (
    name: string,
    minThreshold?: number,
    remarks?: string,
    allowDuplicateOverride?: boolean
  ) => Promise<boolean>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  updateCounterStock: (
    branchId: string,
    data: { male: number; female: number; kids: number; note?: string }
  ) => Promise<{ success: boolean; branch: Branch; message: string }>;
  resetDatabase: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouse, setWarehouse] = useState<WarehouseInventory | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [reconciliationInfo, setReconciliationInfo] =
    useState<ValidationSummaryResponse['reconciliation'] | null>(null);

  const [currentUser, setCurrentUser] = useState<UserSession>(PRESET_USERS[0]); // default to Receptionist
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [orderPrefillBranchId, setOrderPrefillBranchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [brRes, ordRes, altRes, mvtRes, whRes, valRes] = await Promise.all([
        api.getBranches(),
        api.getOrders(),
        api.getAlerts(),
        api.getActivityLog(),
        api.getWarehouse(),
        api.getValidation(),
      ]);

      if (brRes.success) setBranches(brRes.branches);
      if (ordRes.success) setOrders(ordRes.orders);
      if (altRes.success) setAlerts(altRes.alerts);
      if (mvtRes.success) setMovements(mvtRes.movements);
      if (whRes.success) setWarehouse(whRes.warehouse);
      if (valRes.success) {
        setValidationIssues(valRes.issues);
        setReconciliationInfo(valRes.reconciliation);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching data from server:', err);
      setError('Failed to sync with Eyekart server. Please verify connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setApiAuth({ role: currentUser.role, userId: currentUser.id, email: currentUser.email });
  }, [currentUser]);

  useEffect(() => {
    refreshData();
    // Refresh periodically every 30 seconds
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const openOrderDrawer = (branchId?: string) => {
    if (branchId) setOrderPrefillBranchId(branchId);
    setOrderDrawerOpen(true);
  };

  const closeOrderDrawer = () => {
    setOrderDrawerOpen(false);
    setOrderPrefillBranchId(null);
  };

  const createOrder = async (data: {
    branchId: string;
    male: number;
    female: number;
    kids: number;
    remarks?: string;
    isSubmit?: boolean;
  }) => {
    try {
      const res = await api.createOrder({
        ...data,
        actor: currentUser.name,
        actorRole: currentUser.role,
      });
      showToast(
        'success',
        `Order ${res.order.orderNumber} successfully ${data.isSubmit ? 'submitted for dispatch approval' : 'saved as draft'}.`
      );
      await refreshData();
      closeOrderDrawer();
      return res.order;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create order');
      throw err;
    }
  };

  const submitOrder = async (id: string) => {
    try {
      const res = await api.submitOrder(id, currentUser.name);
      showToast('success', `Order ${res.order.orderNumber} submitted for approval.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit order');
      throw err;
    }
  };

  const approveOrder = async (
    id: string,
    data: { approvedMale?: number; approvedFemale?: number; approvedKids?: number }
  ) => {
    try {
      const res = await api.approveOrder(id, { ...data, actor: currentUser.name });
      showToast('success', `Order ${res.order.orderNumber} approved by ${currentUser.name}.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to approve order');
      throw err;
    }
  };

  const dispatchOrder = async (
    id: string,
    data: {
      courierRef?: string;
      dispatchedMale?: number;
      dispatchedFemale?: number;
      dispatchedKids?: number;
    }
  ) => {
    try {
      const res = await api.dispatchOrder(id, { ...data, actor: currentUser.name });
      showToast('success', `Order ${res.order.orderNumber} dispatched from Central Warehouse.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to dispatch order');
      throw err;
    }
  };

  const receiveOrder = async (
    id: string,
    data: { receivedMale?: number; receivedFemale?: number; receivedKids?: number }
  ) => {
    try {
      const res = await api.receiveOrder(id, { ...data, actor: currentUser.name });
      showToast(
        'success',
        `Order ${res.order.orderNumber} delivery confirmed! Stock added to ${res.branch.name} on-hand inventory.`
      );
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to confirm receipt');
      throw err;
    }
  };

  const rejectOrder = async (id: string, reason: string) => {
    try {
      const res = await api.rejectOrder(id, { reason, actor: currentUser.name });
      showToast('warning', `Order ${res.order.orderNumber} rejected.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reject order');
      throw err;
    }
  };

  const cancelOrder = async (id: string, reason: string) => {
    try {
      const res = await api.cancelOrder(id, { reason, actor: currentUser.name });
      showToast('info', `Order ${res.order.orderNumber} cancelled.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to cancel order');
      throw err;
    }
  };

  const adjustStock = async (
    branchId: string,
    category: StockCategory,
    newQuantity: number,
    reason: string
  ) => {
    try {
      await api.adjustInventory({
        branchId,
        category,
        newQuantity,
        reason,
        actor: currentUser.name,
      });
      showToast('success', `Inventory balance updated with audit log entry.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to adjust inventory');
      throw err;
    }
  };

  const updateBranchThreshold = async (branchId: string, minThreshold: number) => {
    try {
      await api.updateBranch(branchId, { minThreshold });
      showToast('success', `Minimum stock alert threshold updated to ${minThreshold} frames.`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update threshold');
      throw err;
    }
  };

  const verifyBranchName = async (branchId: string, canonicalName?: string) => {
    try {
      const res = await api.verifyBranchName(branchId, canonicalName);
      showToast('success', `Branch name verified & cleaned: '${res.branch.name}'`);
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to verify branch name');
      throw err;
    }
  };

  const createBranch = async (
    name: string,
    minThreshold = 50,
    remarks = 'MIX Metals &Plast',
    allowDuplicateOverride = false
  ) => {
    try {
      const res = await api.createBranch({
        name,
        minThreshold,
        remarks,
        allowDuplicateOverride,
        actor: currentUser.name,
      });

      if (res.isDuplicateConflict && !allowDuplicateOverride) {
        showToast('warning', res.error || 'Duplicate branch detected.');
        return false;
      }

      if (res.success) {
        showToast('success', `Branch '${name}' created successfully.`);
        await refreshData();
        return true;
      }
      return false;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create branch');
      return false;
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId, currentUser.name);
      showToast('info', 'Alert acknowledged. Note: Physical stock shortage remains active until replenished.');
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to acknowledge alert');
    }
  };

  const updateCounterStock = async (
    branchId: string,
    data: { male: number; female: number; kids: number; note?: string }
  ) => {
    try {
      const res = await api.updateCounterStock(branchId, {
        ...data,
        actor: currentUser.name,
      });
      showToast('success', res.message || 'Counter stock updated successfully.');
      await refreshData();
      return res;
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update counter stock');
      throw err;
    }
  };

  const resetDatabase = async () => {
    try {
      await api.resetDatabase();
      showToast('success', 'Database reset to original 35 spreadsheet records successfully.');
      await refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to reset database');
    }
  };

  return (
    <AppContext.Provider
      value={{
        branches,
        orders,
        alerts,
        movements,
        warehouse,
        validationIssues,
        reconciliationInfo,
        currentUser,
        activeTab,
        selectedBranchId,
        orderDrawerOpen,
        orderPrefillBranchId,
        searchQuery,
        loading,
        error,
        toasts,
        setActiveTab,
        setSearchQuery,
        openOrderDrawer,
        closeOrderDrawer,
        setSelectedBranchId,
        switchUser: setCurrentUser,
        showToast,
        removeToast,
        refreshData,
        createOrder,
        submitOrder,
        approveOrder,
        dispatchOrder,
        receiveOrder,
        rejectOrder,
        cancelOrder,
        adjustStock,
        updateBranchThreshold,
        verifyBranchName,
        createBranch,
        acknowledgeAlert,
        updateCounterStock,
        resetDatabase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
