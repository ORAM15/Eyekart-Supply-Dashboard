import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import type { Order, OrderStatus } from '../types/index.js';
import {
  ShoppingCart,
  Search,
  Filter,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  RotateCcw,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const {
    orders,
    branches,
    currentUser,
    openOrderDrawer,
    submitOrder,
    approveOrder,
    dispatchOrder,
    receiveOrder,
    rejectOrder,
    cancelOrder,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Dialog state
  const [activeActionOrder, setActiveActionOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<
    'approve' | 'dispatch' | 'receive' | 'reject' | 'cancel' | null
  >(null);

  // Form states for dialogs
  const [courierRef, setCourierRef] = useState('Eyekart Fleet Nairobi / G4S');
  const [actionReason, setActionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Quantities for partial/verified actions
  const [quantities, setQuantities] = useState({ male: 0, female: 0, kids: 0 });

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    if (branchFilter !== 'ALL' && o.branchId !== branchFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchBranch = o.branchName.toLowerCase().includes(q);
      const matchUser = o.requestedBy.toLowerCase().includes(q);
      if (!matchNum && !matchBranch && !matchUser) return false;
    }
    return true;
  });

  const openActionDialog = (
    order: Order,
    type: 'approve' | 'dispatch' | 'receive' | 'reject' | 'cancel'
  ) => {
    setActiveActionOrder(order);
    setActionType(type);
    setActionReason('');
    setCourierRef('Eyekart Fleet Nairobi / G4S Express');

    if (type === 'approve') {
      setQuantities({
        male: order.requestedItems.male,
        female: order.requestedItems.female,
        kids: order.requestedItems.kids,
      });
    } else if (type === 'dispatch') {
      setQuantities({
        male: order.approvedItems?.male ?? order.requestedItems.male,
        female: order.approvedItems?.female ?? order.requestedItems.female,
        kids: order.approvedItems?.kids ?? order.requestedItems.kids,
      });
    } else if (type === 'receive') {
      setQuantities({
        male: order.dispatchedItems?.male ?? 0,
        female: order.dispatchedItems?.female ?? 0,
        kids: order.dispatchedItems?.kids ?? 0,
      });
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActionOrder) return;
    setProcessing(true);

    try {
      if (actionType === 'approve') {
        await approveOrder(activeActionOrder.id, {
          approvedMale: quantities.male,
          approvedFemale: quantities.female,
          approvedKids: quantities.kids,
        });
      } else if (actionType === 'dispatch') {
        await dispatchOrder(activeActionOrder.id, {
          courierRef,
          dispatchedMale: quantities.male,
          dispatchedFemale: quantities.female,
          dispatchedKids: quantities.kids,
        });
      } else if (actionType === 'receive') {
        await receiveOrder(activeActionOrder.id, {
          receivedMale: quantities.male,
          receivedFemale: quantities.female,
          receivedKids: quantities.kids,
        });
      } else if (actionType === 'reject') {
        await rejectOrder(activeActionOrder.id, actionReason || 'Stock requisition rejected by administration.');
      } else if (actionType === 'cancel') {
        await cancelOrder(activeActionOrder.id, actionReason || 'Cancelled by branch receptionist.');
      }

      setActiveActionOrder(null);
      setActionType(null);
    } catch (err) {
      // Toast already shown
    } finally {
      setProcessing(false);
    }
  };

  const statusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'SUBMITTED':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'APPROVED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'DISPATCHED':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'RECEIVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Order & Requisition Register
          </h2>
          <p className="text-xs text-slate-500">
            End-to-end lifecycle management: Draft → Submitted → Approved → Dispatched → Received
          </p>
        </div>

        <button
          onClick={() => openOrderDrawer()}
          className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, branch name, or user..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="RECEIVED">Received</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 font-semibold uppercase text-[10px]">Branch:</span>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 max-w-[180px]"
          >
            <option value="ALL">All 35 Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table & Cards */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-slate-700 text-sm">No Orders Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No orders match the selected filters. Use the "New Stock Order" button to create an
              eyewear requisition.
            </p>
          </div>
        ) : (
          filteredOrders.map((ord) => {
            const isExpanded = expandedOrderId === ord.id;
            return (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Main Row */}
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {ord.orderNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusBadge(
                            ord.status
                          )}`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 font-semibold mt-0.5">
                        {ord.branchName} •{' '}
                        <span className="font-normal text-slate-500">
                          {new Date(ord.createdAt).toLocaleString('en-GB', {
                            timeZone: 'Africa/Nairobi',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Breakdown Chips */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                      Male: <strong>{ord.requestedItems.male}</strong>
                    </span>
                    <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                      Female: <strong>{ord.requestedItems.female}</strong>
                    </span>
                    <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-medium">
                      Kids: <strong>{ord.requestedItems.kids}</strong>
                    </span>
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded font-black">
                      Total: {ord.requestedItems.total}
                    </span>
                  </div>

                  {/* Lifecycle Action Buttons */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Draft Actions */}
                    {ord.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => submitOrder(ord.id)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => openActionDialog(ord, 'cancel')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {/* Submitted Actions (Admin approve/reject or receptionist cancel) */}
                    {ord.status === 'SUBMITTED' && (
                      <>
                        {currentUser.role === 'ADMIN' ? (
                          <>
                            <button
                              onClick={() => openActionDialog(ord, 'approve')}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openActionDialog(ord, 'reject')}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openActionDialog(ord, 'cancel')}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold text-xs"
                          >
                            Cancel Request
                          </button>
                        )}
                      </>
                    )}

                    {/* Approved Actions (Warehouse/Admin dispatch) */}
                    {ord.status === 'APPROVED' && (
                      <button
                        onClick={() => openActionDialog(ord, 'dispatch')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch Stock</span>
                      </button>
                    )}

                    {/* Dispatched Actions (Receptionist/Admin confirm delivery) */}
                    {ord.status === 'DISPATCHED' && (
                      <button
                        onClick={() => openActionDialog(ord, 'receive')}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs"
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Confirm Delivery & Add Stock</span>
                      </button>
                    )}

                    {/* Received status badge */}
                    {ord.status === 'RECEIVED' && (
                      <span className="flex items-center space-x-1 text-emerald-700 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Fulfilled</span>
                      </span>
                    )}

                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details & Timeline */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200 p-5 space-y-4 text-xs">
                    {/* Remarks and Courier info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          Requisition Notes
                        </span>
                        <p className="text-slate-600">{ord.remarks || 'No remarks provided.'}</p>
                        <div className="text-[11px] text-slate-400 mt-2">
                          Requested by: {ord.requestedBy} ({ord.requestedByRole})
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                          Dispatch & Fulfillment Tracking
                        </span>
                        <div className="space-y-1 text-slate-600">
                          <div>
                            Courier Reference:{' '}
                            <strong>{ord.courierRef || 'Not yet dispatched'}</strong>
                          </div>
                          {ord.approvedBy && <div>Approved by: {ord.approvedBy}</div>}
                          {ord.dispatchedBy && <div>Dispatched by: {ord.dispatchedBy}</div>}
                          {ord.receivedBy && <div>Delivery confirmed by: {ord.receivedBy}</div>}
                          {ord.rejectionReason && (
                            <div className="text-rose-700 font-semibold">
                              Rejection reason: {ord.rejectionReason}
                            </div>
                          )}
                          {ord.cancellationReason && (
                            <div className="text-slate-500">
                              Cancellation reason: {ord.cancellationReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timeline visualization */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block mb-3">
                        Order Lifecycle Event Trail
                      </span>
                      <div className="space-y-3">
                        {ord.timeline.map((event, idx) => (
                          <div key={idx} className="flex items-start space-x-3 text-xs">
                            <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5"></div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900">{event.status}</span>
                                <span className="text-slate-400 text-[11px]">
                                  {new Date(event.timestamp).toLocaleString('en-GB', {
                                    timeZone: 'Africa/Nairobi',
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-600 text-[11px] mt-0.5">
                                {event.notes} • By: {event.actor}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Action Dialog Modal */}
      {actionType && activeActionOrder && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {actionType === 'approve' && 'Approve Frame Requisition'}
              {actionType === 'dispatch' && 'Dispatch Frames from Central Warehouse'}
              {actionType === 'receive' && 'Confirm Delivery & Accept Stock'}
              {actionType === 'reject' && 'Reject Stock Order'}
              {actionType === 'cancel' && 'Cancel Stock Order'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Order {activeActionOrder.orderNumber} for {activeActionOrder.branchName}
            </p>

            <form onSubmit={handleExecuteAction} className="my-4 space-y-4 text-xs">
              {/* Category quantities adjustment for approve, dispatch, or receive */}
              {(actionType === 'approve' || actionType === 'dispatch' || actionType === 'receive') && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="font-bold text-slate-800">
                    Verify Quantities for {actionType}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Male</label>
                      <input
                        type="number"
                        min="0"
                        value={quantities.male}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            male: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Female</label>
                      <input
                        type="number"
                        min="0"
                        value={quantities.female}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            female: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Kids</label>
                      <input
                        type="number"
                        min="0"
                        value={quantities.kids}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            kids: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-bold text-teal-800 pt-1">
                    Total: {quantities.male + quantities.female + quantities.kids} frames
                  </div>
                </div>
              )}

              {/* Courier Ref field for Dispatch */}
              {actionType === 'dispatch' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Courier Reference / Driver Details
                  </label>
                  <input
                    type="text"
                    required
                    value={courierRef}
                    onChange={(e) => setCourierRef(e.target.value)}
                    placeholder="e.g. Eyekart Delivery Van #3 / G4S Waybill #KE-9921"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              )}

              {/* Reason for Reject / Cancel */}
              {(actionType === 'reject' || actionType === 'cancel') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mandatory Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Provide clear rationale for order rejection or cancellation..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5"
                  />
                </div>
              )}

              {actionType === 'receive' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                  <span className="font-bold">Atomic Stock Policy: </span>
                  Confirming delivery immediately increases on-hand stock for{' '}
                  <strong>{activeActionOrder.branchName}</strong> and clears resolved stock shortage
                  alerts automatically.
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionOrder(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg shadow-xs disabled:opacity-40"
                >
                  {processing ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
