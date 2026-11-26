import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  History,
  QrCode,
  Wrench,
  ClipboardCheck,
  ShieldAlert,
  ArrowUpRight,
  Boxes,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  Asset,
  WorkOrder,
  PreventiveMaintenance,
  SafetyIncident,
  Shop,
  Language,
  NavPage,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardPageProps {
  lang: Language;
  selectedShop: string;
  assets: Asset[];
  workOrders: WorkOrder[];
  pmRecords: PreventiveMaintenance[];
  safetyIncidents: SafetyIncident[];
  shops: Shop[];
  onNavigate: (page: NavPage) => void;
  onInspectTrolley: (trolleyNumber: string) => void;
  onOpenScanner: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  lang,
  selectedShop,
  assets,
  workOrders,
  pmRecords,
  safetyIncidents,
  shops,
  onNavigate,
  onInspectTrolley,
  onOpenScanner,
}) => {
  const t = getTranslation(lang);

  const scopedAssets = useMemo(
    () => (selectedShop === 'ALL' ? assets : assets.filter((a) => a.shopCode === selectedShop)),
    [assets, selectedShop]
  );
  const scopedWOs = useMemo(
    () =>
      selectedShop === 'ALL' ? workOrders : workOrders.filter((w) => w.shopCode === selectedShop),
    [workOrders, selectedShop]
  );
  const scopedPMs = useMemo(
    () =>
      selectedShop === 'ALL' ? pmRecords : pmRecords.filter((p) => p.shopCode === selectedShop),
    [pmRecords, selectedShop]
  );
  const scopedSafety = useMemo(
    () =>
      selectedShop === 'ALL'
        ? safetyIncidents
        : safetyIncidents.filter((s) => s.shopCode === selectedShop),
    [safetyIncidents, selectedShop]
  );

  const metrics = useMemo(() => {
    const totalTrolleys = scopedAssets.length;
    const activeTrolleys = scopedAssets.filter((a) => a.operationalStatus === 'active').length;
    const readinessPct =
      totalTrolleys > 0 ? Math.round((activeTrolleys / totalTrolleys) * 100) : 100;
    const openWorkOrders = scopedWOs.filter(
      (w) => !['Completed', 'Closed', 'Cancelled', 'Rejected'].includes(w.status)
    ).length;
    const criticalWOs = scopedWOs.filter(
      (w) =>
        (w.priority === 'Critical' || w.priority === 'Urgent') &&
        !['Completed', 'Closed', 'Cancelled', 'Rejected'].includes(w.status)
    ).length;
    const completedPMs = scopedPMs.filter((p) => p.status === 'Completed').length;
    const pmCompliance =
      scopedPMs.length > 0 ? Math.round((completedPMs / scopedPMs.length) * 100) : 100;
    const lockouts = scopedAssets.filter(
      (a) => a.safetyStatus === 'unsafe_locked' || a.condition === 'quarantined_unsafe'
    ).length;

    return {
      totalTrolleys,
      activeTrolleys,
      readinessPct,
      openWorkOrders,
      criticalWOs,
      pmCompliance,
      completedPMs,
      lockouts,
      openSafetyCount: scopedSafety.filter((s) => s.status !== 'Resolved & Cleared').length,
    };
  }, [scopedAssets, scopedWOs, scopedPMs, scopedSafety]);

  const shopChartData = useMemo(() => {
    const targetShops =
      selectedShop === 'ALL' ? shops : shops.filter((s) => s.code === selectedShop);
    return targetShops.map((shop) => ({
      shopCode: shop.code,
      trolleys: assets.filter((a) => a.shopCode === shop.code).length,
      openJobs: workOrders.filter(
        (w) =>
          w.shopCode === shop.code &&
          !['Completed', 'Closed', 'Cancelled', 'Rejected'].includes(w.status)
      ).length,
      breakdowns: workOrders.filter((w) => w.shopCode === shop.code && w.isBreakdown).length,
    }));
  }, [shops, assets, workOrders, selectedShop]);

  const conditionChartData = useMemo(() => {
    return [
      {
        name: t.statusLabels.excellent,
        value: scopedAssets.filter((a) => a.condition === 'excellent').length,
        color: '#16a34a',
      },
      {
        name: t.statusLabels.good,
        value: scopedAssets.filter((a) => a.condition === 'good').length,
        color: '#2563eb',
      },
      {
        name: t.statusLabels.needs_repair,
        value: scopedAssets.filter((a) => a.condition === 'needs_repair').length,
        color: '#d97706',
      },
      {
        name: t.statusLabels.quarantined_unsafe,
        value: scopedAssets.filter(
          (a) => a.condition === 'critical_damage' || a.condition === 'quarantined_unsafe'
        ).length,
        color: '#dc2626',
      },
    ].filter((d) => d.value > 0);
  }, [scopedAssets, t.statusLabels]);

  const recentWorkOrders = useMemo(() => {
    return [...scopedWOs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6);
  }, [scopedWOs]);

  const urgentItems = useMemo(() => {
    const openIncidents = scopedSafety.filter((s) => s.status !== 'Resolved & Cleared');
    const overduePMs = scopedPMs.filter((p) => p.status === 'Overdue');
    return { openIncidents, overduePMs };
  }, [scopedSafety, scopedPMs]);

  return (
    <div className="space-y-6">
      {/* Industrial Command Header Banner (Operational Readiness — Zero Financial/ROI Metrics) */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-red-400">
            <span>{t.brandName}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedShop === 'ALL' ? t.allLines : selectedShop}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">{t.dashboard.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5">
            <p className="text-[11px] font-medium text-slate-400">{t.dashboard.fleetReadiness}</p>
            <p className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
              {metrics.readinessPct}%
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap"
          >
            <QrCode className="w-4 h-4 text-red-400" />
            {t.common.scanQr}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('trolley-history')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-lg shadow-red-900/30 transition-colors whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            {t.dashboard.inspectHistory}
          </button>
        </div>
      </div>

      {/* High-Contrast 4-Column Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t.dashboard.totalTrolleys}</p>
              <p className="font-display text-3xl font-extrabold text-slate-900 tabular-nums mt-2">
                {metrics.totalTrolleys}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 text-white">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{t.dashboard.activeTrolleys}</span>
            <StatusBadge label={`${metrics.activeTrolleys} Ready`} tone="emerald" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t.dashboard.openBreakdowns}</p>
              <p className="font-display text-3xl font-extrabold text-slate-900 tabular-nums mt-2">
                {metrics.openWorkOrders}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Urgent / Critical</span>
            <StatusBadge
              label={`${metrics.criticalWOs} Priority`}
              tone={metrics.criticalWOs > 0 ? 'red' : 'emerald'}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t.dashboard.pmCompliance}</p>
              <p className="font-display text-3xl font-extrabold text-slate-900 tabular-nums mt-2">
                {metrics.pmCompliance}%
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Completed Cycles</span>
            <StatusBadge
              label={`${metrics.completedPMs} / ${scopedPMs.length}`}
              tone={metrics.pmCompliance >= 80 ? 'emerald' : 'amber'}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t.dashboard.safetyLockouts}</p>
              <p className="font-display text-3xl font-extrabold text-slate-900 tabular-nums mt-2">
                {metrics.lockouts}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Open Safety Cases</span>
            <StatusBadge
              label={`${metrics.openSafetyCount} Active`}
              tone={metrics.openSafetyCount > 0 ? 'red' : 'emerald'}
            />
          </div>
        </div>
      </div>

      {/* Analytics + Lockout Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">{t.dashboard.shopLoadChart}</h2>
            <span className="text-xs text-slate-500">Live Fleet & WOs</span>
          </div>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 520, height: 256 }}
            >
              <BarChart data={shopChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="shopCode" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="trolleys" name="Assigned Trolleys" fill="#0f172a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="openJobs" name="Open Jobs" fill="#D71920" radius={[4, 4, 0, 0]} />
                <Bar dataKey="breakdowns" name="Total Breakdowns" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">{t.dashboard.healthBreakdown}</h2>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {scopedAssets.length} Units
            </span>
          </div>
          <div className="h-48 w-full min-w-0 flex-1">
            {conditionChartData.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                initialDimension={{ width: 380, height: 192 }}
              >
                <PieChart>
                  <Pie
                    data={conditionChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={3}
                  >
                    {conditionChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                {t.common.noData}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
            {conditionChartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-50"
              >
                <span className="text-slate-700 font-medium truncate">{item.name}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Split: Recent Work Orders Table + Urgent Safety & PM Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">{t.dashboard.recentActivity}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('work-orders')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {t.dashboard.logBreakdown}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pm')}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                {t.dashboard.logPm}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                  <th className="py-3 px-4">{t.workOrders.woNumber}</th>
                  <th className="py-3 px-4">{t.assets.trolleyNumber}</th>
                  <th className="py-3 px-4">{t.common.shop}</th>
                  <th className="py-3 px-4">{t.workOrders.activityType}</th>
                  <th className="py-3 px-4">{t.common.priority}</th>
                  <th className="py-3 px-4">{t.common.status}</th>
                  <th className="py-3 px-4 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentWorkOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {t.common.noData}
                    </td>
                  </tr>
                ) : (
                  recentWorkOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {wo.workOrderNumber}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">
                        {wo.trolleyNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{wo.shopCode}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {wo.isBreakdown
                          ? `Breakdown · ${wo.failureType || wo.activityType}`
                          : wo.activityType}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge label={wo.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge label={wo.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {wo.trolleyNumber && (
                          <button
                            type="button"
                            onClick={() => onInspectTrolley(wo.trolleyNumber!)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#D71920] hover:underline whitespace-nowrap"
                          >
                            {t.assets.viewHistory}
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Urgent Safety Lockouts & Overdue PM Alerts */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">{t.dashboard.urgentAlerts}</h2>
            <StatusBadge
              label={`${urgentItems.openIncidents.length + urgentItems.overduePMs.length} Alerts`}
              tone={
                urgentItems.openIncidents.length + urgentItems.overduePMs.length > 0
                  ? 'red'
                  : 'emerald'
              }
            />
          </div>

          <div className="space-y-3">
            {urgentItems.openIncidents.length === 0 && urgentItems.overduePMs.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All trolleys cleared and quarterly PM schedules nominal.</span>
              </div>
            ) : (
              <>
                {urgentItems.openIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {inc.trolleyNumber || inc.shopCode}
                      </span>
                      <StatusBadge label={inc.severity} tone="red" />
                    </div>
                    <p className="text-xs text-red-900/90 leading-relaxed">{inc.description}</p>
                    {inc.trolleyNumber && (
                      <button
                        type="button"
                        onClick={() => onInspectTrolley(inc.trolleyNumber!)}
                        className="text-[11px] font-semibold text-[#D71920] hover:underline"
                      >
                        Inspect Lifecycle →
                      </button>
                    )}
                  </div>
                ))}

                {urgentItems.overduePMs.map((pm) => (
                  <div
                    key={pm.id}
                    className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-900 font-mono">
                        {pm.trolleyNumber} · {pm.quarter} {pm.year}
                      </span>
                      <StatusBadge label="Overdue PM" tone="red" />
                    </div>
                    <p className="text-xs text-amber-900/90">
                      Scheduled {pm.scheduledDate || 'N/A'} ({pm.shopCode})
                    </p>
                    <button
                      type="button"
                      onClick={() => onInspectTrolley(pm.trolleyNumber)}
                      className="text-[11px] font-semibold text-amber-900 hover:underline"
                    >
                      View Trolley History →
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
