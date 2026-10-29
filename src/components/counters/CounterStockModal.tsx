import React, { useState, useEffect } from 'react';
import type { Branch, StockMovement } from '../../types/index.js';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';
import { isLiveCrudConfigured } from '../../services/auth.js';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  Minus,
  Plus,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface CounterStockModalProps {
  counterNumber: number;
  branch: Branch;
  onClose: () => void;
}

export const CounterStockModal: React.FC<CounterStockModalProps> = ({
  counterNumber,
  branch,
  onClose,
}) => {
  const { updateCounterStock, refreshData } = useApp();
  const isSnapshotMode = !isLiveCrudConfigured();

  // Local state for stock quantities
  const [male, setMale] = useState<number>(branch.inventory.male.onHand);
  const [female, setFemale] = useState<number>(branch.inventory.female.onHand);
  const [kids, setKids] = useState<number>(branch.inventory.kids.onHand);
  const [note, setNote] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Minimum required stock is 50 frames
  const minRequired = branch.minThreshold || 50;
  const currentTotal = male + female + kids;
  const isBelowMin = currentTotal < minRequired;
  const shortage = Math.max(0, minRequired - currentTotal);

  // Fetch branch movements for history
  useEffect(() => {
    let isMounted = true;
    async function fetchBranchData() {
      try {
        setLoadingHistory(true);
        const data = await api.getBranch(branch.id);
        if (isMounted) {
          // Sort movements latest first
          const sorted = (data.movements || []).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setHistory(sorted);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }
    fetchBranchData();
    return () => {
      isMounted = false;
    };
  }, [branch.id]);

  // Plus and Minus button handlers
  const handleDecrement = (category: 'male' | 'female' | 'kids') => {
    if (category === 'male') setMale((prev) => Math.max(0, prev - 1));
    if (category === 'female') setFemale((prev) => Math.max(0, prev - 1));
    if (category === 'kids') setKids((prev) => Math.max(0, prev - 1));
  };

  const handleIncrement = (category: 'male' | 'female' | 'kids') => {
    if (category === 'male') setMale((prev) => prev + 1);
    if (category === 'female') setFemale((prev) => prev + 1);
    if (category === 'kids') setKids((prev) => prev + 1);
  };

  const handleInputChange = (
    category: 'male' | 'female' | 'kids',
    valueStr: string
  ) => {
    const parsed = parseInt(valueStr, 10);
    const safeVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    if (category === 'male') setMale(safeVal);
    if (category === 'female') setFemale(safeVal);
    if (category === 'kids') setKids(safeVal);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isSnapshotMode) {
        setErrorMessage('This deployment is read-only. Your +/− edits are only a preview and were not saved. Configure Supabase Auth and the live database before recording stock changes.');
        return;
      }
      if (note.trim().length < 3) {
        setErrorMessage('Enter a reason of at least 3 characters. Every real stock adjustment must have an audit note.');
        return;
      }

      const res = await updateCounterStock(branch.id, {
        male,
        female,
        kids,
        note: note.trim(),
      });

      setSuccessMessage(
        `Stock saved successfully! Counter ${counterNumber} now has ${male + female + kids} frames in stock.`
      );
      setNote('');

      // Refresh local history
      const freshData = await api.getBranch(branch.id);
      const sorted = (freshData.movements || []).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setHistory(sorted);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Failed to save stock changes. Please check connection and retry.'
      );
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    male !== branch.inventory.male.onHand ||
    female !== branch.inventory.female.onHand ||
    kids !== branch.inventory.kids.onHand ||
    note.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header Bar */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 font-extrabold text-xs tracking-wider rounded-lg border border-teal-500/30">
                EYEKART STOCK MANAGER
              </span>
              {currentTotal === 0 ? (
                <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  OUT OF STOCK
                </span>
              ) : isBelowMin ? (
                <span className="px-2.5 py-0.5 bg-amber-500 text-slate-900 text-xs font-bold rounded-full">
                  LOW STOCK ({currentTotal}/50)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">
                  GOOD STOCK ({currentTotal})
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Counter {counterNumber}
            </h2>
            <p className="text-sm text-slate-300 font-medium">
              Branch: <span className="text-teal-200 font-semibold">{branch.name}</span>
            </p>
          </div>

          {/* BACK TO ALL COUNTERS Button */}
          <button
            onClick={onClose}
            className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 rounded-xl text-sm font-bold border border-slate-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Counters</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">
          {isSnapshotMode ? (
            <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-extrabold uppercase tracking-wide">Preview adjustments only</p>
              <p className="mt-1 text-xs leading-relaxed">
                The +/− buttons and quantity fields update this counter preview. Saving is unavailable in snapshot mode, so draft changes will not change official branch stock and will be discarded when this window closes.
              </p>
            </div>
          ) : (
            <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-extrabold uppercase tracking-wide">Live inventory connection</p>
              <p className="mt-1 text-xs leading-relaxed">
                Saving writes the new quantities to the live database and appends an audit entry. Changes refresh other open dashboards within a few seconds. A reason is required for every save.
              </p>
            </div>
          )}

          {/* Success Message Banner */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-start gap-3 text-emerald-900 animate-in fade-in">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold text-sm text-emerald-900">Success</p>
                <p className="text-xs text-emerald-800 font-medium">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-start gap-3 text-red-900 animate-in fade-in">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold text-sm text-red-900">Error Saving Changes</p>
                <p className="text-xs text-red-800 font-medium">{errorMessage}</p>
              </div>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg"
              >
                Retry
              </button>
            </div>
          )}

          {/* Total & Threshold Banner */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              currentTotal === 0
                ? 'bg-red-50 border-red-300 text-red-950'
                : isBelowMin
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                {currentTotal === 0 ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : isBelowMin ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
                <h4 className="font-black text-base">
                  {currentTotal === 0
                    ? 'Counter is OUT OF STOCK'
                    : isBelowMin
                    ? 'Counter is LOW STOCK'
                    : 'Counter Stock is HEALTHY'}
                </h4>
              </div>
              <p className="text-xs font-medium mt-1">
                Minimum required stock: <strong className="font-bold">{minRequired} frames</strong>
                {isBelowMin && (
                  <span className="font-bold text-red-700 ml-2">
                    (Below minimum by {shortage} frames)
                  </span>
                )}
              </p>
            </div>

            <div className="bg-white/90 px-4 py-2 rounded-xl border border-slate-200/60 shadow-sm text-center min-w-[130px]">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Frames
              </span>
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {currentTotal}
              </span>
            </div>
          </div>

          {/* THREE CATEGORIES SECTION: MALE, FEMALE, KIDS */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Adjust Frame Quantities
            </h3>

            {/* 1. MALE FRAMES */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Category 1
                </span>
                <h4 className="text-lg font-black text-slate-900">Male Frames</h4>
                <p className="text-xs text-slate-500">
                  Initial stock: {branch.inventory.male.onHand} frames
                </p>
              </div>

              {/* [ - ] QUANTITY [ + ] */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDecrement('male')}
                  disabled={male <= 0}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm flex items-center justify-center text-slate-800 transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Decrease Male Frames"
                >
                  <Minus className="w-7 h-7 stroke-[3]" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={male}
                  onChange={(e) => handleInputChange('male', e.target.value)}
                  className="w-20 sm:w-24 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-black text-slate-900 bg-white border-2 border-slate-300 rounded-2xl shadow-inner focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                />

                <button
                  type="button"
                  onClick={() => handleIncrement('male')}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-md flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Increase Male Frames"
                >
                  <Plus className="w-7 h-7 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* 2. FEMALE FRAMES */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Category 2
                </span>
                <h4 className="text-lg font-black text-slate-900">Female Frames</h4>
                <p className="text-xs text-slate-500">
                  Initial stock: {branch.inventory.female.onHand} frames
                </p>
              </div>

              {/* [ - ] QUANTITY [ + ] */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDecrement('female')}
                  disabled={female <= 0}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm flex items-center justify-center text-slate-800 transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Decrease Female Frames"
                >
                  <Minus className="w-7 h-7 stroke-[3]" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={female}
                  onChange={(e) => handleInputChange('female', e.target.value)}
                  className="w-20 sm:w-24 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-black text-slate-900 bg-white border-2 border-slate-300 rounded-2xl shadow-inner focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                />

                <button
                  type="button"
                  onClick={() => handleIncrement('female')}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-md flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Increase Female Frames"
                >
                  <Plus className="w-7 h-7 stroke-[3]" />
                </button>
              </div>
            </div>

            {/* 3. KIDS' FRAMES */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Category 3
                </span>
                <h4 className="text-lg font-black text-slate-900">Kids' Frames</h4>
                <p className="text-xs text-slate-500">
                  Initial stock: {branch.inventory.kids.onHand} frames
                </p>
              </div>

              {/* [ - ] QUANTITY [ + ] */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDecrement('kids')}
                  disabled={kids <= 0}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border-2 border-slate-300 hover:border-slate-400 active:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm flex items-center justify-center text-slate-800 transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Decrease Kids Frames"
                >
                  <Minus className="w-7 h-7 stroke-[3]" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={kids}
                  onChange={(e) => handleInputChange('kids', e.target.value)}
                  className="w-20 sm:w-24 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-black text-slate-900 bg-white border-2 border-slate-300 rounded-2xl shadow-inner focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                />

                <button
                  type="button"
                  onClick={() => handleIncrement('kids')}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-md flex items-center justify-center transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Increase Kids Frames"
                >
                  <Plus className="w-7 h-7 stroke-[3]" />
                </button>
              </div>
            </div>
          </div>

          {/* Simple text field for an optional note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Mandatory Audit Note / Reason
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required: e.g. physical count verified, broken frames removed, delivery received"
              className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-colors"
            />
          </div>

          {/* Action Buttons: SAVE and BACK TO ALL COUNTERS */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isSnapshotMode || note.trim().length < 3}
              title={isSnapshotMode ? 'Saving is disabled in read-only snapshot mode' : note.trim().length < 3 ? 'Add an audit reason before saving' : 'Save stock changes to the live database'}
              className="w-full sm:flex-1 py-4 px-6 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-2xl shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2 transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{isSnapshotMode ? 'Saving Disabled — Read-Only Mode' : 'Save Stock Changes Live'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-4 px-6 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-base rounded-2xl transition-colors"
            >
              Back to All Counters
            </button>
          </div>

          {/* 4. RECENT HISTORY SECTION */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Recent Stock History
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {history.length} recorded movements
              </span>
            </div>

            {loadingHistory ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading recent history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                No recent stock movements recorded for this counter yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {history.slice(0, 15).map((mvt) => {
                    const date = new Date(mvt.timestamp);
                    const formattedDate = date.toLocaleDateString('en-KE', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const change = mvt.quantityChanged;
                    const changeClass =
                      change > 0
                        ? 'text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded'
                        : change < 0
                        ? 'text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded'
                        : 'text-slate-600 font-medium';

                    return (
                      <div
                        key={mvt.id}
                        className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 min-w-[120px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formattedDate}</span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 capitalize">
                              {mvt.category === 'all'
                                ? 'All Categories'
                                : `${mvt.category} Frames`}
                            </span>
                            {mvt.reason && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">
                                {mvt.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="text-[11px] text-slate-400">
                            Prev: {mvt.previousOnHand}
                          </span>
                          <span className={changeClass}>
                            {change > 0 ? `+${change}` : change}
                          </span>
                          <span className="font-bold text-slate-900">
                            → {mvt.resultingOnHand}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
