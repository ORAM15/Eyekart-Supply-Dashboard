import React from 'react';
import { useApp } from '../context/AppContext.js';
import {
  Building2,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Truck,
  PackageCheck,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Glasses,
  PlusCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    branches,
    orders,
    alerts,
    movements,
    warehouse,
    openOrderDrawer,
    setSelectedBranchId,
    setActiveTab,
  } = useApp();

  // Genuine database KPI calculations
  const totalBranches = branches.length;
  const totalFrames = branches.reduce((acc, b) => acc + b.inventory.totalOnHand, 0);
  const maleTotal = branches.reduce((acc, b) => acc + b.inventory.male.onHand, 0);
  const femaleTotal = branches.reduce((acc, b) => acc + b.inventory.female.onHand, 0);
  const kidsTotal = branches.reduce((acc, b) => acc + b.inventory.kids.onHand, 0);

  const lowStockBranches = branches.filter(
    (b) => b.inventory.totalOnHand > 0 && b.inventory.totalOnHand < b.minThreshold
  );
  const zeroStockBranches = branches.filter((b) => b.inventory.totalOnHand === 0);
  const totalBelowMin = lowStockBranches.length + zeroStockBranches.length;

  const pendingOrders = orders.filter((o) => o.status === 'SUBMITTED');
  const awaitingDispatch = orders.filter((o) => o.status === 'APPROVED');
  const awaitingReceipt = orders.filter((o) => o.status === 'DISPATCHED');

  const malePct = totalFrames > 0 ? ((maleTotal / totalFrames) * 100).toFixed(1) : '0';
  const femalePct = totalFrames > 0 ? ((femaleTotal / totalFrames) * 100).toFixed(1) : '0';
  const kidsPct = totalFrames > 0 ? ((kidsTotal / totalFrames) * 100).toFixed(1) : '0';

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0B192C] to-[#1E3E62] text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span>Eyekart Healthcare Limited</span>
            <span>•</span>
            <span>Retail Optical Network (Kenya)</span>
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Eyewear Stock & Branch Order Control
          </h2>
          <p className="text-slate-300 text-xs mt-1 max-w-xl">
            Live multi-category frame balances across all 35 counter outlets. Real-time order dispatch, atomic delivery receipt, and low-stock protection.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => openOrderDrawer()}
            className="flex items-center space-x-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Frame Order</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-700 transition-colors"
          >
            <span>Monthly Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* KPI 1 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Branches</span>
            <Building2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{totalBranches}</div>
          <div className="text-[10px] text-teal-700 font-medium mt-0.5">35 Source Outlets</div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Stock</span>
            <Boxes className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{totalFrames.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Frames in Branches</div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Below Min (50)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600">{totalBelowMin}</div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Needs Replenishment</div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Zero Stock</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600">{zeroStockBranches.length}</div>
          <div className="text-[10px] text-rose-700 font-medium mt-0.5">Critical Out of Stock</div>
        </div>

        {/* KPI 5 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Orders</span>
            <ShoppingCart className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{pendingOrders.length}</div>
          <div className="text-[10px] text-sky-700 font-medium mt-0.5">Awaiting Admin Approval</div>
        </div>

        {/* KPI 6 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Dispatch</span>
            <Truck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{awaitingDispatch.length}</div>
          <div className="text-[10px] text-indigo-700 font-medium mt-0.5">Ready for Logistics</div>
        </div>

        {/* KPI 7 */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">In Transit</span>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{awaitingReceipt.length}</div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Awaiting Branch Receipt</div>
        </div>
      </div>

      {/* Frame Category Distribution Visual Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Stock Distribution by Eyewear Category
            </h3>
            <p className="text-slate-500 text-xs">
              Total 3,740 frames categorized into Male, Female, and Kids frames
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Reconciled against SSD Frame Supply List
          </div>
        </div>

        {/* Multi-segmented bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100">
          <div
            style={{ width: `${malePct}%` }}
            className="bg-indigo-600 transition-all duration-500"
            title={`Male Frames: ${maleTotal} (${malePct}%)`}
          />
          <div
            style={{ width: `${femalePct}%` }}
            className="bg-teal-500 transition-all duration-500"
            title={`Female Frames: ${femaleTotal} (${femalePct}%)`}
          />
          <div
            style={{ width: `${kidsPct}%` }}
            className="bg-amber-400 transition-all duration-500"
            title={`Kids' Frames: ${kidsTotal} (${kidsPct}%)`}
          />
        </div>

        {/* Legends */}
        <div className="grid grid-cols-3 gap-4 pt-1">
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
            <div className="w-3 h-3 rounded-full bg-indigo-600 shrink-0"></div>
            <div>
              <div className="text-xs font-bold text-indigo-950">
                Male Frames: {maleTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-indigo-700">{malePct}% of total inventory</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-teal-50/60 border border-teal-100">
            <div className="w-3 h-3 rounded-full bg-teal-500 shrink-0"></div>
            <div>
              <div className="text-xs font-bold text-teal-950">
                Female Frames: {femaleTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-teal-700">{femalePct}% of total inventory</div>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0"></div>
            <div>
              <div className="text-xs font-bold text-amber-950">
                Kids' Frames: {kidsTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-700">{kidsPct}% of total inventory</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Critical Stock Alerts + Pending Requisitions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Out-of-Stock and Low-Stock Immediate Action Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Active Stock Shortage Alerts ({activeAlerts.length})
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('alerts')}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                View Alert Register →
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Branches flagged below the mandatory 50-frames policy threshold.
            </p>

            <div className="space-y-2.5">
              {activeAlerts.slice(0, 4).map((alt) => (
                <div
                  key={alt.id}
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    alt.currentStock === 0
                      ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                      : 'bg-amber-50/60 border-amber-200 text-amber-950'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs">{alt.branchName}</span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                          alt.currentStock === 0
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {alt.currentStock === 0 ? '0 Frames' : `${alt.currentStock} Frames`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Shortage: {alt.shortageAmount} frames | M:{alt.maleBalance} F:{alt.femaleBalance} K:{alt.kidsBalance}
                    </div>
                  </div>

                  <button
                    onClick={() => openOrderDrawer(alt.branchId)}
                    className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors shrink-0"
                  >
                    Replenish
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Note: Diani, Iten, Ol Kalou, and Rongai were imported from source spreadsheet with zero stock.
          </div>
        </div>

        {/* Pending Requisitions / Action Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Orders Requiring Attention ({orders.filter((o) => o.status !== 'RECEIVED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED').length})
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                View All Orders →
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Requisitions in pipeline across approval, dispatch, and physical delivery stages.
            </p>

            {orders.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500">No active orders in progress.</p>
                <button
                  onClick={() => openOrderDrawer()}
                  className="mt-2 text-xs font-bold text-teal-700 hover:underline"
                >
                  Create New Branch Order
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {orders.slice(0, 4).map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === 'DRAFT'
                              ? 'bg-slate-200 text-slate-700'
                              : ord.status === 'SUBMITTED'
                              ? 'bg-sky-100 text-sky-800'
                              : ord.status === 'APPROVED'
                              ? 'bg-indigo-100 text-indigo-800'
                              : ord.status === 'DISPATCHED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {ord.branchName} • Total: {ord.requestedItems.total} frames (M:{ord.requestedItems.male}, F:{ord.requestedItems.female}, K:{ord.requestedItems.kids})
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-teal-700 hover:bg-teal-50 p-1.5 rounded-lg transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Central Warehouse Stock: {warehouse?.totalOnHand.toLocaleString()} frames</span>
            <button
              onClick={() => setActiveTab('inventory')}
              className="text-teal-700 font-semibold hover:underline"
            >
              Warehouse Details
            </button>
          </div>
        </div>
      </div>

      {/* Branch Inventory Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Branch Network Inventory Snapshot
            </h3>
            <p className="text-slate-500 text-xs">
              Summary of all 35 retail outlets and counter locations in Kenya
            </p>
          </div>
          <button
            onClick={() => setActiveTab('branches')}
            className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Explore All 35 Branches →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold">SRN</th>
                <th className="py-3 px-4 font-bold">Branch Name</th>
                <th className="py-3 px-4 font-bold text-right">Male</th>
                <th className="py-3 px-4 font-bold text-right">Female</th>
                <th className="py-3 px-4 font-bold text-right">Kids</th>
                <th className="py-3 px-4 font-bold text-right text-slate-900">Total Stock</th>
                <th className="py-3 px-4 font-bold text-center">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {branches.slice(0, 8).map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-400 font-mono">#{b.srn}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                    <span>{b.name}</span>
                    {b.hasNameAnomaly && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Review
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">{b.inventory.male.onHand}</td>
                  <td className="py-3 px-4 text-right">{b.inventory.female.onHand}</td>
                  <td className="py-3 px-4 text-right">{b.inventory.kids.onHand}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    {b.inventory.totalOnHand}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'LOW_STOCK'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => openOrderDrawer(b.id)}
                      className="text-teal-700 hover:text-teal-900 font-bold hover:underline"
                    >
                      Order
                    </button>
                    <button
                      onClick={() => setSelectedBranchId(b.id)}
                      className="text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
