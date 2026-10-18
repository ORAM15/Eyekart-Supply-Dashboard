import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { X, Building2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBranchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { branches, createBranch } = useApp();
  const [name, setName] = useState('');
  const [minThreshold, setMinThreshold] = useState<number>(50);
  const [remarks, setRemarks] = useState('MIX Metals &Plast');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  // Real-time duplicate check
  const checkDuplicate = (inputName: string) => {
    const clean = inputName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) {
      setDuplicateWarning(null);
      return;
    }
    const match = branches.find((b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
    if (match) {
      setDuplicateWarning(
        `Warning: '${inputName}' matches existing branch '${match.name}' (SRN #${match.srn}).`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent, override = false) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const ok = await createBranch(name.trim(), minThreshold, remarks.trim(), override);
      if (ok) {
        setName('');
        setMinThreshold(50);
        setRemarks('MIX Metals &Plast');
        setDuplicateWarning(null);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-sm">Add New Eyewear Branch / Counter</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Branch Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                checkDuplicate(e.target.value);
              }}
              placeholder="e.g. Bliss Westlands"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {duplicateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="font-semibold">{duplicateWarning}</div>
              </div>
              <p className="text-[11px] text-amber-800">
                Normalized duplicate detection rule prevents accidental creation of duplicate branch records.
              </p>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="w-full py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors text-xs"
              >
                Administrator Override (Force Create)
              </button>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Minimum Stock Alert Threshold (Frames)
            </label>
            <input
              type="number"
              min="1"
              value={minThreshold}
              onChange={(e) => setMinThreshold(parseInt(e.target.value, 10) || 50)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-bold text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">Default policy minimum is 50 frames.</p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Remarks / Frame Material
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg font-medium text-slate-900"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg transition-colors disabled:opacity-40"
            >
              {submitting ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
