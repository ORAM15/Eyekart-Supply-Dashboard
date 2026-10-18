import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.js';
import {
  X,
  Plus,
  Minus,
  AlertTriangle,
  Send,
  Save,
  CheckCircle,
  Building,
  Boxes,
  HelpCircle,
} from 'lucide-react';

export const OrderModal: React.FC = () => {
  const {
    branches,
    orderDrawerOpen,
    closeOrderDrawer,
    orderPrefillBranchId,
    createOrder,
    currentUser,
  } = useApp();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [maleQty, setMaleQty] = useState<number>(0);
  const [femaleQty, setFemaleQty] = useState<number>(0);
  const [kidsQty, setKidsQty] = useState<number>(0);
  const [stepSize, setStepSize] = useState<number>(1);
  const [remarks, setRemarks] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'draft' | 'submit'>('submit');

  useEffect(() => {
    if (orderDrawerOpen) {
      if (orderPrefillBranchId) {
        setSelectedBranchId(orderPrefillBranchId);
      } else if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
      }
      setMaleQty(0);
      setFemaleQty(0);
      setKidsQty(0);
      setRemarks('');
      setStepSize(1);
    }
  }, [orderDrawerOpen, orderPrefillBranchId, branches]);

  if (!orderDrawerOpen) return null;

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const totalRequested = maleQty + femaleQty + kidsQty;

  const handleAdjust = (category: 'male' | 'female' | 'kids', delta: number) => {
    if (category === 'male') setMaleQty((prev) => Math.max(0, prev + delta));
    if (category === 'female') setFemaleQty((prev) => Math.max(0, prev + delta));
    if (category === 'kids') setKidsQty((prev) => Math.max(0, prev + delta));
  };

  const handleManualInput = (category: 'male' | 'female' | 'kids', value: string) => {
    const val = Math.max(0, parseInt(value, 10) || 0);
    if (category === 'male') setMaleQty(val);
    if (category === 'female') setFemaleQty(val);
    if (category === 'kids') setKidsQty(val);
  };

  const handleTriggerAction = (action: 'draft' | 'submit') => {
    if (totalRequested <= 0) {
      alert('Order must contain at least 1 frame across Male, Female, or Kids categories.');
      return;
    }
    setPendingAction(action);
    setShowConfirmModal(true);
  };

  const executeConfirmedOrder = async () => {
    if (!currentBranch) return;
    setSubmitting(true);
    try {
      await createOrder({
        branchId: currentBranch.id,
        male: maleQty,
        female: femaleQty,
        kids: kidsQty,
        remarks,
        isSubmit: pendingAction === 'submit',
      });
      setShowConfirmModal(false);
    } catch (err) {
      // Toast already shown
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wider">
                Requisition Portal
              </span>
              <span className="text-xs text-slate-500 font-medium">
                User: {currentUser.name} ({currentUser.role})
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              Create Eyewear Stock Order
            </h2>
          </div>
          <button
            onClick={closeOrderDrawer}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Branch Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Branch / Outlet <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (On-hand: {b.inventory.totalOnHand} frames | Status: {b.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Branch Stock Snapshot & Alert Warning */}
          {currentBranch && (
            <div
              className={`p-4 rounded-xl border ${
                currentBranch.inventory.totalOnHand === 0
                  ? 'bg-rose-50/70 border-rose-200'
                  : currentBranch.inventory.totalOnHand < currentBranch.minThreshold
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Boxes className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Current Branch Inventory Balances
                  </span>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    currentBranch.status === 'HEALTHY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : currentBranch.status === 'LOW_STOCK'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {currentBranch.status} ({currentBranch.inventory.totalOnHand} / Min {currentBranch.minThreshold})
                </span>
              </div>

              {/* Balances pills */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs mt-3">
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Male</div>
                  <div className="text-sm font-bold text-slate-900">
                    {currentBranch.inventory.male.onHand}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Female</div>
                  <div className="text-sm font-bold text-slate-900">
                    {currentBranch.inventory.female.onHand}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Kids</div>
                  <div className="text-sm font-bold text-slate-900">
                    {currentBranch.inventory.kids.onHand}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Stock</div>
                  <div className="text-sm font-extrabold text-teal-700">
                    {currentBranch.inventory.totalOnHand}
                  </div>
                </div>
              </div>

              {currentBranch.inventory.totalOnHand < currentBranch.minThreshold && (
                <div className="flex items-start space-x-2 mt-3 text-xs text-amber-900 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Low Stock Warning: </span>
                    Current stock is below the mandatory 50 frames threshold. Shortage of{' '}
                    <span className="font-bold underline">
                      {Math.max(0, currentBranch.minThreshold - currentBranch.inventory.totalOnHand)}
                    </span>{' '}
                    frames.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantity Controls Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select Quantities to Request
                </h3>
                <p className="text-[11px] text-slate-500">
                  Use [+] and [−] buttons or enter exact numbers. Negative values are forbidden.
                </p>
              </div>

              {/* Step size selector */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
                <span className="text-[10px] font-semibold text-slate-500 px-1.5 uppercase">Step:</span>
                {[1, 5, 10, 25].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStepSize(s)}
                    className={`px-2 py-0.5 rounded font-bold transition-colors ${
                      stepSize === s
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ±{s}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Rows: Male, Female, Kids */}
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
              {/* Male Frames */}
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-xs font-bold text-slate-900">Male Frames</div>
                  <div className="text-[11px] text-slate-500">
                    Current on-hand:{' '}
                    <span className="font-semibold text-slate-700">
                      {currentBranch?.inventory.male.onHand || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleAdjust('male', -stepSize)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={maleQty <= 0}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={maleQty}
                    onChange={(e) => handleManualInput('male', e.target.value)}
                    className="w-20 text-center font-bold text-slate-900 text-base py-1 px-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust('male', stepSize)}
                    className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Female Frames */}
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-xs font-bold text-slate-900">Female Frames</div>
                  <div className="text-[11px] text-slate-500">
                    Current on-hand:{' '}
                    <span className="font-semibold text-slate-700">
                      {currentBranch?.inventory.female.onHand || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleAdjust('female', -stepSize)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={femaleQty <= 0}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={femaleQty}
                    onChange={(e) => handleManualInput('female', e.target.value)}
                    className="w-20 text-center font-bold text-slate-900 text-base py-1 px-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust('female', stepSize)}
                    className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Kids' Frames */}
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <div>
                  <div className="text-xs font-bold text-slate-900">Kids' Frames</div>
                  <div className="text-[11px] text-slate-500">
                    Current on-hand:{' '}
                    <span className="font-semibold text-slate-700">
                      {currentBranch?.inventory.kids.onHand || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleAdjust('kids', -stepSize)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={kidsQty <= 0}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={kidsQty}
                    onChange={(e) => handleManualInput('kids', e.target.value)}
                    className="w-20 text-center font-bold text-slate-900 text-base py-1 px-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust('kids', stepSize)}
                    className="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Total Order Summary Banner */}
            <div className="flex items-center justify-between p-3.5 bg-teal-900 text-white rounded-xl shadow-xs">
              <div>
                <div className="text-[11px] font-semibold text-teal-300 uppercase tracking-wider">
                  Total Order Request
                </div>
                <div className="text-xs text-teal-100 mt-0.5">
                  Male: {maleQty} | Female: {femaleQty} | Kids: {kidsQty}
                </div>
              </div>
              <div className="text-2xl font-black text-teal-300 tracking-tight">
                {totalRequested}{' '}
                <span className="text-xs font-normal text-teal-100">frames</span>
              </div>
            </div>
          </div>

          {/* Remarks Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Order Remarks / Courier Note (Optional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Urgent weekend restock, preferred mix of acetate and titanium..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder-slate-400"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-100/70 p-3 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-700">Inventory Policy Notice: </span>
            Submitting a stock order does NOT immediately increment branch on-hand stock. Stock
            increases only when Central Warehouse dispatches and the branch receptionist confirms
            physical delivery.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between space-x-3">
          <button
            type="button"
            onClick={closeOrderDrawer}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={submitting || totalRequested <= 0}
              onClick={() => handleTriggerAction('draft')}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={submitting || totalRequested <= 0}
              onClick={() => handleTriggerAction('submit')}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Submit for Approval</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Order {pendingAction === 'submit' ? 'Submission' : 'Draft'}
            </h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to {pendingAction === 'submit' ? 'submit this order for central approval' : 'save this draft'}?
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 my-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Branch:</span>
                <span className="font-bold text-slate-900">{currentBranch?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Male Frames:</span>
                <span className="font-bold text-slate-900">{maleQty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Female Frames:</span>
                <span className="font-bold text-slate-900">{femaleQty}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kids Frames:</span>
                <span className="font-bold text-slate-900">{kidsQty}</span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold">
                <span className="text-teal-900">Total Frames:</span>
                <span className="text-teal-700 text-sm">{totalRequested} frames</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={executeConfirmedOrder}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-xs"
              >
                {submitting ? 'Processing...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
