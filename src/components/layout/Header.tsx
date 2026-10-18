import React, { useState, useEffect } from 'react';
import { useApp, PRESET_USERS } from '../../context/AppContext.js';
import {
  Search,
  Bell,
  Clock,
  UserCheck,
  ChevronDown,
  ShieldAlert,
  Glasses,
  Plus,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    switchUser,
    alerts,
    searchQuery,
    setSearchQuery,
    openOrderDrawer,
    setActiveTab,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Formatter for Africa/Nairobi
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(now);

      setCurrentTime(`${timeStr} EAT`);
      setCurrentDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 sticky top-0 shadow-xs">
      {/* Search Input */}
      <div className="flex items-center w-80 max-w-sm">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches, orders, frames..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-medium text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      {/* Center Clock (Nairobi Time) */}
      <div className="hidden md:flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
        <Clock className="w-3.5 h-3.5 text-teal-600" />
        <span className="font-semibold text-slate-800">{currentTime}</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">{currentDate}</span>
      </div>

      {/* Right Tools: Notification Bell, New Order CTA, User Switcher */}
      <div className="flex items-center space-x-3">
        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setAlertsDropdownOpen(!alertsDropdownOpen);
              setUserDropdownOpen(false);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg relative transition-colors"
            title="Stock Alerts"
          >
            <Bell className="w-5 h-5" />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>

          {alertsDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Stock Alerts ({activeAlerts.length})
                </span>
                <button
                  onClick={() => {
                    setActiveTab('alerts');
                    setAlertsDropdownOpen(false);
                  }}
                  className="text-teal-600 hover:underline font-semibold"
                >
                  View All
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {activeAlerts.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">
                    No active stock alerts. All branches healthy.
                  </div>
                ) : (
                  activeAlerts.map((alt) => (
                    <div key={alt.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{alt.branchName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            alt.currentStock === 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {alt.currentStock === 0 ? 'Out of Stock' : `${alt.currentStock} frames left`}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-1">{alt.recommendedAction}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Order Button */}
        <button
          onClick={() => openOrderDrawer()}
          className="hidden sm:flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Order</span>
        </button>

        {/* User Profile & Role Switcher */}
        <div className="relative">
          <button
            onClick={() => {
              setUserDropdownOpen(!userDropdownOpen);
              setAlertsDropdownOpen(false);
            }}
            className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-all"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                currentUser.role === 'ADMIN'
                  ? 'bg-indigo-600'
                  : currentUser.role === 'RECEPTIONIST'
                  ? 'bg-teal-600'
                  : 'bg-amber-600'
              }`}
            >
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">{currentUser.name}</p>
                <p className="text-slate-500 text-[11px]">{currentUser.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  {currentUser.title}
                </span>
              </div>

              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Switch Role / User
              </div>

              <div className="space-y-1 px-2">
                {PRESET_USERS.map((usr) => (
                  <button
                    key={usr.id}
                    onClick={() => {
                      switchUser(usr);
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                      currentUser.id === usr.id
                        ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{usr.name}</div>
                      <div className="text-[10px] text-slate-500">{usr.title}</div>
                    </div>
                    {currentUser.id === usr.id && (
                      <UserCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
