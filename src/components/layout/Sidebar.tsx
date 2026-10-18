import React from 'react';
import { useApp } from '../../context/AppContext.js';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  Boxes,
  BellRing,
  ClipboardList,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
  PlusCircle,
  Glasses,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, alerts, validationIssues, openOrderDrawer } = useApp();

  const activeAlertsCount = alerts.filter((a) => !a.resolvedAt).length;
  const pendingValidationCount = validationIssues.filter((v) => v.status === 'PENDING_REVIEW').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'branches', label: 'Branch Outlets', icon: Building2 },
    { id: 'orders', label: 'Orders & Requisitions', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory & Warehouse', icon: Boxes },
    {
      id: 'alerts',
      label: 'Stock Alerts',
      icon: BellRing,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'activity', label: 'Audit & Movement Log', icon: ClipboardList },
    { id: 'reports', label: 'Monthly Reports', icon: FileSpreadsheet },
    {
      id: 'validation',
      label: 'Data Validation',
      icon: ShieldCheck,
      badge: pendingValidationCount > 0 ? pendingValidationCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    { id: 'settings', label: 'Settings & Database', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0B192C] text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20">
            <Glasses className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base tracking-tight leading-none">
              EYEKART
            </h1>
            <p className="text-[11px] font-medium text-teal-400 tracking-wider uppercase mt-1">
              Healthcare Ltd (KE)
            </p>
          </div>
        </div>
      </div>

      {/* Receptionist Quick Order Call to Action */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => openOrderDrawer()}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-sm shadow-emerald-900/40 active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Stock Order</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
          Management Console
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border-l-2 border-teal-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Network Status
          </span>
          <span className="flex items-center space-x-1.5 text-emerald-400 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Online</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400">Timezone: Africa/Nairobi (EAT)</p>
      </div>
    </aside>
  );
};
