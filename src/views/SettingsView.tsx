import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Settings,
  Database,
  ShieldCheck,
  RotateCcw,
  Clock,
  Building2,
  Server,
  Key,
  Users,
  CheckCircle2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { branches, orders, movements, alerts, currentUser, switchUser, resetDatabase } =
    useApp();

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetExecute = async () => {
    setResetting(true);
    try {
      await resetDatabase();
      setConfirmResetOpen(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          System Configuration & Database Controls
        </h2>
        <p className="text-xs text-slate-500">
          Environment settings, persistence status, role-based access control, and database maintenance
        </p>
      </div>

      {/* Database & Environment Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Live Persistent Storage Engine
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Backed by persistent JSON database on disk with in-memory transaction locking, atomic temporary file swaps, and real-time state synchronization across concurrent sessions.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Operating System / Server:</span>
              <span className="font-semibold text-slate-800">Node.js Express + TSX Runtime</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Configured Timezone:</span>
              <span className="font-semibold text-slate-800">Africa/Nairobi (UTC+3, EAT)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Currency Unit:</span>
              <span className="font-semibold text-slate-800">Kenyan Shilling (KES) / Frame Units</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Branches in Database:</span>
              <span className="font-bold text-teal-700">{branches.length} records</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Total Recorded Orders:</span>
              <span className="font-bold text-slate-800">{orders.length} orders</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Stock Movements Logged:</span>
              <span className="font-bold text-slate-800">{movements.length} audit entries</span>
            </div>
          </div>
        </div>

        {/* Security & Firebase Blueprint Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Role-Based Access Control (RBAC) & Cloud Security
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Current active authenticated profile and security specifications for multi-receptionist operation.
          </p>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Active User:</span>
              <span className="font-bold text-slate-900">{currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-mono text-slate-700">{currentUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-teal-100 text-teal-800 uppercase">
                {currentUser.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Title:</span>
              <span className="text-slate-700">{currentUser.title}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Firebase Intermediate Blueprint: Active (`firebase-blueprint.json`)</span>
            </div>
            <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Hardened Firestore Security Rules: Compiled (`firestore.rules`)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Re-initialization & Reset */}
      <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <RotateCcw className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-slate-900 text-sm">
            Spreadsheet Baseline Reset (Restore 35 Source Branches)
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Restore database state to the pristine 35 branch rows from the "SSD FRAME SUPPLY LIST" spreadsheet image, resetting stock counts back to 3,740 total frames, 4 zero-stock branches, and Bliss Busia anomaly flag.
        </p>

        <button
          onClick={() => setConfirmResetOpen(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
        >
          Reset Database to Source Spreadsheet Baseline
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Confirm Source Spreadsheet Reset
            </h3>
            <p className="text-slate-600 mt-2">
              Are you sure? This will reset all branch stock balances back to the initial 3,740 frames
              from the SSD Frame Supply List image and clear sample demo orders.
            </p>

            <div className="flex justify-end space-x-2 mt-5">
              <button
                type="button"
                disabled={resetting}
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetExecute}
                className="px-5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
