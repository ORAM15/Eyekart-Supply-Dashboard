import React from 'react';
import type { Branch } from '../../types/index.js';
import { AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

interface CounterCardProps {
  counterNumber: number;
  branch: Branch;
  onClick: () => void;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  counterNumber,
  branch,
  onClick,
}) => {
  const totalStock = branch.inventory.totalOnHand;
  const minRequired = branch.minThreshold || 50;

  // Simple colours:
  // Green: stock is 50 or more
  // Orange: stock is between 1 and 49
  // Red: stock is zero
  let statusBadge: {
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    cardBorder: string;
    icon: React.ReactNode;
  };

  if (totalStock === 0) {
    statusBadge = {
      label: 'OUT OF STOCK',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
      borderColor: 'border-red-300',
      cardBorder: 'border-red-300 hover:border-red-500 hover:shadow-red-100',
      icon: <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />,
    };
  } else if (totalStock < minRequired) {
    statusBadge = {
      label: 'LOW STOCK',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-800',
      borderColor: 'border-amber-300',
      cardBorder: 'border-amber-300 hover:border-amber-500 hover:shadow-amber-100',
      icon: <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />,
    };
  } else {
    statusBadge = {
      label: 'GOOD',
      bgColor: 'bg-emerald-100',
      textColor: 'text-emerald-800',
      borderColor: 'border-emerald-300',
      cardBorder: 'border-slate-200 hover:border-emerald-500 hover:shadow-emerald-50',
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />,
    };
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex flex-col justify-between p-5 bg-white rounded-2xl border-2 ${statusBadge.cardBorder} shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer text-left select-none focus:outline-none focus:ring-2 focus:ring-teal-500`}
    >
      {/* Top Header: Counter number and Status Badge */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors">
            Counter {counterNumber}
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.bgColor} ${statusBadge.textColor} ${statusBadge.borderColor}`}
          >
            {statusBadge.icon}
            {statusBadge.label}
          </span>
        </div>

        {/* Original Branch Name in smaller text under each counter number */}
        <p
          className="text-xs text-slate-500 font-medium truncate mb-4"
          title={branch.name}
        >
          {branch.name}
        </p>

        {/* Total Current Stock in large readable text */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 group-hover:bg-teal-50/50 transition-colors">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            Total Current Stock
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-black tracking-tight ${
                totalStock === 0
                  ? 'text-red-600'
                  : totalStock < minRequired
                  ? 'text-amber-700'
                  : 'text-slate-900'
              }`}
            >
              {totalStock}
            </span>
            <span className="text-xs font-semibold text-slate-500">frames</span>
          </div>

          {/* Breakdown: Male, Female, Kids */}
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-1 text-[11px] text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px]">Male</span>
              <span className="font-bold text-slate-800">{branch.inventory.male.onHand}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Female</span>
              <span className="font-bold text-slate-800">{branch.inventory.female.onHand}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Kids</span>
              <span className="font-bold text-slate-800">{branch.inventory.kids.onHand}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Minimum required stock & guidance */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="font-medium">
          Min required: <strong className="text-slate-700">{minRequired} frames</strong>
        </span>

        {totalStock < minRequired && (
          <span className="font-bold text-red-600 text-[11px]">
            Short by {minRequired - totalStock}
          </span>
        )}
      </div>
    </div>
  );
};
