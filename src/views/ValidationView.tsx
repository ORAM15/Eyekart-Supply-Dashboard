import React, { useState } from 'react';
import { useApp } from '../context/AppContext.js';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Building2,
  Boxes,
  HelpCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const ValidationView: React.FC = () => {
  const {
    validationIssues,
    reconciliationInfo,
    branches,
    verifyBranchName,
    currentUser,
  } = useApp();

  const [testBranchName, setTestBranchName] = useState('');
  const [duplicateTestResult, setDuplicateTestResult] = useState<string | null>(null);

  const busiaBranch = branches.find((b) => b.id === 'br-001');

  const handleTestDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testBranchName.trim()) return;

    const normalized = testBranchName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = branches.find(
      (b) => b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
    );

    if (found) {
      setDuplicateTestResult(
        `[DUPLICATE DETECTED] '${testBranchName}' matches registered branch '${found.name}' (SRN #${found.srn}). Normalized key: '${normalized}'. Creation blocked unless administrator overrides.`
      );
    } else {
      setDuplicateTestResult(
        `[UNIQUE] '${testBranchName}' is unique. No conflicting normalized branch names found across all 35 active records.`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Spreadsheet Data Validation & Integrity Screen
        </h2>
        <p className="text-xs text-slate-500">
          Auditing initial data import from "SSD FRAME SUPPLY LIST" spreadsheet image
        </p>
      </div>

      {/* Sheet Total Reconciliation Card */}
      {reconciliationInfo && (
        <div
          className={`p-6 rounded-2xl border shadow-xs ${
            reconciliationInfo.isReconciled
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-rose-50/70 border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              {reconciliationInfo.isReconciled ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
              <h3 className="font-bold text-slate-900 text-sm">
                Spreadsheet Total Verification (Row 38 Total vs Calculated Sum)
              </h3>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                reconciliationInfo.isReconciled
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-rose-200 text-rose-900'
              }`}
            >
              {reconciliationInfo.isReconciled ? 'Reconciled & Verified' : 'Discrepancy Detected'}
            </span>
          </div>

          <p className="text-xs text-slate-600 mb-4">
            The source spreadsheet displays cell G38: "TOTAL FRAMES: 3,740". The system calculated
            the sum from each of the 35 imported branch rows.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Sheet Reported Total
              </span>
              <div className="text-lg font-black text-slate-900 mt-1">
                {reconciliationInfo.reportedSheetTotal.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Calculated Row Sum
              </span>
              <div className="text-lg font-black text-teal-700 mt-1">
                {reconciliationInfo.calculatedTotal.toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Category Sum (M+F+K)
              </span>
              <div className="text-lg font-black text-slate-900 mt-1">
                {reconciliationInfo.totalMale} + {reconciliationInfo.totalFemale} +{' '}
                {reconciliationInfo.totalKids} = {reconciliationInfo.calculatedTotal}
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Variance Discrepancy
              </span>
              <div
                className={`text-lg font-black mt-1 ${
                  reconciliationInfo.discrepancy === 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {reconciliationInfo.discrepancy === 0
                  ? '0 (Exact Match)'
                  : `${reconciliationInfo.discrepancy} frames`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Findings & Anomaly Resolutions */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
          Import Audit Items & Flagged Discrepancies
        </h3>

        {/* Issue 1: Busia Formula Text */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                Formula Artifact
              </span>
              <h4 className="font-bold text-slate-900 text-sm">
                Branch #1 Name Anomaly: 'Bliss BusiaB3:D27'
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-xl">
              Spreadsheet cell B3 contains accidental drag/formula text 'B3:D27' appended to 'Bliss Busia'.
              Original source preserved in audit metadata.
            </p>
            <div className="text-[11px] text-slate-500">
              Current Registered Name in DB:{' '}
              <strong className="text-slate-800 font-mono">{busiaBranch?.name}</strong>
              {busiaBranch?.isVerified && (
                <span className="ml-2 text-emerald-700 font-semibold">(Verified Canonical)</span>
              )}
            </div>
          </div>

          {busiaBranch && busiaBranch.hasNameAnomaly && (
            <button
              onClick={() => verifyBranchName(busiaBranch.id, 'Bliss Busia')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
            >
              Verify & Set Canonical Name to 'Bliss Busia'
            </button>
          )}
        </div>

        {/* Issue 2 & 3: SRN Sequence Gaps */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
              Sequence Integrity
            </span>
            <h4 className="font-bold text-slate-900 text-sm">
              Serial Number (SRN) Sequence Gaps: Gaps at #3 and #35
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            Source spreadsheet SRN column jumps from #2 (Bliss Diani) to #4 (Bliss Eldama Ravine),
            and from #34 (Clinix Haille Selasie) to #36 (Medicross Nakuru).
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
            <span className="font-bold">Compliance Resolution: </span>
            Exactly 35 branch records imported without inventing fake branches or dummy records to fill
            the sequence numbers. Each branch is assigned an immutable internal ID (e.g. <code>br-001</code> through <code>br-037</code>).
          </div>
        </div>

        {/* Issue 4: 4 Zero-Stock Outlets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
              Zero Stock
            </span>
            <h4 className="font-bold text-slate-900 text-sm">
              Visibly Highlighted Zero-Stock Outlets (Diani, Iten, Ol Kalou, Rongai)
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            Four rows in the spreadsheet image are visibly highlighted with 0 stock in all columns.
            Imported faithfully with 0 male, 0 female, 0 kids frames.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {['Bliss Diani (SRN 2)', 'Bliss Iten (SRN 10)', 'Bliss Ol Kalou (SRN 28)', 'Bliss Rongai (SRN 29)'].map(
              (name) => (
                <div key={name} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-950 font-bold text-center">
                  {name}
                </div>
              )
            )}
          </div>
        </div>

        {/* Issue 5: Bliss Siaya Kids Zero */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
              Category Zero
            </span>
            <h4 className="font-bold text-slate-900 text-sm">
              Bliss Siaya Explicit Zero Kids' Frames
            </h4>
          </div>
          <p className="text-xs text-slate-600">
            Row 31 of spreadsheet shows Bliss Siaya with 40 Male, 50 Female, and 0 Kids frames (Total: 90 frames).
            Faithfully preserved as 0 kids frames without fabricating dummy inventory.
          </p>
        </div>
      </div>

      {/* Duplicate Detection Engine Simulator */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            Duplicate Detection Rule Simulator
          </h3>
          <p className="text-xs text-slate-500">
            Test candidate branch names against existing 35 branches using case-insensitive, whitespace-insensitive, and punctuation-normalized algorithms.
          </p>
        </div>

        <form onSubmit={handleTestDuplicate} className="flex items-center space-x-3 text-xs">
          <input
            type="text"
            value={testBranchName}
            onChange={(e) => setTestBranchName(e.target.value)}
            placeholder="Type e.g. 'bliss DIANI', 'Bliss-Thika', 'Medicross   Nakuru'..."
            className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors shrink-0"
          >
            Test Normalization Match
          </button>
        </form>

        {duplicateTestResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium ${
              duplicateTestResult.includes('[DUPLICATE DETECTED]')
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            {duplicateTestResult}
          </div>
        )}
      </div>
    </div>
  );
};
