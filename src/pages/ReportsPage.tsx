import React, { useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet, History, BarChart3, ShieldCheck, Wrench } from 'lucide-react';
import {
  Asset,
  Language,
  PreventiveMaintenance,
  SafetyIncident,
  Shop,
  WorkOrder,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface ReportsPageProps {
  lang: Language;
  selectedShop: string;
  assets: Asset[];
  workOrders: WorkOrder[];
  pmRecords: PreventiveMaintenance[];
  safetyIncidents: SafetyIncident[];
  shops: Shop[];
  onInspectTrolley: (trolleyNumber: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  lang,
  selectedShop,
  assets,
  workOrders,
  pmRecords,
  safetyIncidents,
  shops,
  onInspectTrolley,
}) => {
  const t = getTranslation(lang);

  const scopedAssets = useMemo(
    () => (selectedShop === 'ALL' ? assets : assets.filter((a) => a.shopCode === selectedShop)),
    [assets, selectedShop]
  );

  const scopedShops = useMemo(
    () => (selectedShop === 'ALL' ? shops : shops.filter((s) => s.code === selectedShop)),
    [shops, selectedShop]
  );

  const scopedSafety = useMemo(
    () =>
      selectedShop === 'ALL'
        ? safetyIncidents
        : safetyIncidents.filter((s) => s.shopCode === selectedShop),
    [safetyIncidents, selectedShop]
  );

  // Purely operational trolley lifecycle summary (Zero financial/cost columns)
  const trolleyRows = useMemo(() => {
    return scopedAssets.map((asset) => {
      const assetBreakdowns = workOrders
        .filter(
          (w) =>
            (w.assetId === asset.id || w.trolleyNumber === asset.trolleyNumber) &&
            (w.isBreakdown || w.activityType === 'Repair')
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const completedPMs = pmRecords.filter(
        (p) =>
          (p.assetId === asset.id || p.trolleyNumber === asset.trolleyNumber) &&
          p.status === 'Completed'
      ).length;

      return {
        trolleyNumber: asset.trolleyNumber,
        partNumber: asset.partNumber || '—',
        shopCode: asset.shopCode,
        commissioned: asset.commissioningDate || asset.createdAt.slice(0, 10),
        completedPMs,
        firstBreakdown: assetBreakdowns[0]?.createdAt.slice(0, 10) || 'None',
        totalBreakdowns: assetBreakdowns.length,
        operationalStatus: asset.operationalStatus,
        safetyStatus: asset.safetyStatus,
      };
    });
  }, [scopedAssets, workOrders, pmRecords]);

  const shopTatSummary = useMemo(() => {
    return scopedShops.map((s) => {
      const closedWOs = workOrders.filter(
        (w) => w.shopCode === s.code && typeof w.turnaroundDays === 'number'
      );
      const avgTat =
        closedWOs.length > 0
          ? (
              closedWOs.reduce((acc, w) => acc + (w.turnaroundDays || 0), 0) / closedWOs.length
            ).toFixed(1)
          : '—';
      const totalPM = pmRecords.filter((p) => p.shopCode === s.code).length;
      const donePM = pmRecords.filter(
        (p) => p.shopCode === s.code && p.status === 'Completed'
      ).length;
      return {
        code: s.code,
        name: s.name,
        trolleyCount: assets.filter((a) => a.shopCode === s.code).length,
        breakdowns: workOrders.filter((w) => w.shopCode === s.code && w.isBreakdown).length,
        pmRate: totalPM > 0 ? `${Math.round((donePM / totalPM) * 100)}%` : '100%',
        avgTat,
        targetTat: `${s.targetTAT || 2} d`,
      };
    });
  }, [scopedShops, assets, workOrders, pmRecords]);

  const totalBreakdowns = trolleyRows.reduce((acc, r) => acc + r.totalBreakdowns, 0);
  const totalPmCompleted = trolleyRows.reduce((acc, r) => acc + r.completedPMs, 0);

  const exportLifecyclePdf = () => {
    const docPdf = new jsPDF();
    docPdf.setFontSize(14);
    docPdf.text('Mahindra Auto Steel Private Limited (MASL) - Operational Trolley Lifecycle & Health MIS', 14, 18);
    docPdf.setFontSize(9);
    docPdf.text(
      `Generated: ${new Date().toLocaleString()} | Scope: ${selectedShop} | Total Assets: ${scopedAssets.length}`,
      14,
      25
    );

    autoTable(docPdf, {
      startY: 32,
      head: [
        [
          'Trolley #',
          'Part #',
          'Line',
          'Commissioned',
          'PM Done',
          'First Breakdown',
          'Total BDs',
          'Status',
        ],
      ],
      body: trolleyRows.map((r) => [
        r.trolleyNumber,
        r.partNumber,
        r.shopCode,
        r.commissioned,
        String(r.completedPMs),
        r.firstBreakdown,
        String(r.totalBreakdowns),
        r.operationalStatus,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [215, 25, 32] },
    });

    docPdf.save('MASL_Trolley_Lifecycle_MIS.pdf');
  };

  const exportLifecycleExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsAssets = XLSX.utils.json_to_sheet(trolleyRows);
    const wsLines = XLSX.utils.json_to_sheet(shopTatSummary);
    const wsSafety = XLSX.utils.json_to_sheet(
      scopedSafety.map((s) => ({
        Incident: s.incidentNumber,
        Trolley: s.trolleyNumber || s.shopCode,
        Severity: s.severity,
        Status: s.status,
        Reported: s.reportedAt || '',
        Cleared: s.clearedAt || '',
      }))
    );

    XLSX.utils.book_append_sheet(wb, wsAssets, 'Trolley Lifecycle');
    XLSX.utils.book_append_sheet(wb, wsLines, 'Line PM & TAT');
    XLSX.utils.book_append_sheet(wb, wsSafety, 'Safety Lockouts');
    XLSX.writeFile(wb, 'MASL_Operational_MIS.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.reports.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.reports.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportLifecyclePdf}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-xs whitespace-nowrap transition-colors"
          >
            <FileDown className="w-4 h-4" />
            {t.common.exportPdf}
          </button>
          <button
            type="button"
            onClick={exportLifecycleExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs whitespace-nowrap transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t.common.exportExcel}
          </button>
        </div>
      </div>

      {/* Operational KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Tracked Trolleys
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {trolleyRows.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Verified PM Cycles
            </p>
            <p className="text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
              {totalPmCompleted}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Logged Breakdowns
            </p>
            <p className="text-3xl font-bold text-amber-700 mt-2 tabular-nums">
              {totalBreakdowns}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Report 1: Asset Lifecycle & Breakdown Frequency */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{t.reports.assetHealthReport}</h2>
          <span className="text-xs text-slate-500 font-medium">
            {selectedShop === 'ALL' ? t.allLines : selectedShop}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">{t.assets.trolleyNumber}</th>
                <th className="py-3 px-4">{t.assets.partNumber}</th>
                <th className="py-3 px-4">{t.common.shop}</th>
                <th className="py-3 px-4">{t.assets.commissioningDate}</th>
                <th className="py-3 px-4">PM Cycles</th>
                <th className="py-3 px-4">{t.trolleyHistory.firstBreakdownDate}</th>
                <th className="py-3 px-4">Total Breakdowns</th>
                <th className="py-3 px-4">{t.common.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {trolleyRows.map((row) => (
                <tr key={row.trolleyNumber} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <button
                      type="button"
                      onClick={() => onInspectTrolley(row.trolleyNumber)}
                      className="font-mono font-semibold text-[#D71920] hover:underline inline-flex items-center gap-1"
                    >
                      {row.trolleyNumber}
                      <History className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{row.partNumber}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">{row.shopCode}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                    {row.commissioned}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 tabular-nums">
                    {row.completedPMs}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700 tabular-nums">
                    {row.firstBreakdown}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                    {row.totalBreakdowns}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge label={t.statusLabels[row.operationalStatus]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report 2: Line-wise PM Compliance & Turnaround */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">{t.reports.tatReport}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Line Code</th>
                <th className="py-3 px-4">Processing Line</th>
                <th className="py-3 px-4">Trolleys</th>
                <th className="py-3 px-4">Breakdowns</th>
                <th className="py-3 px-4">PM Compliance</th>
                <th className="py-3 px-4">Avg Repair TAT</th>
                <th className="py-3 px-4">Target TAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {shopTatSummary.map((line) => (
                <tr key={line.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">{line.code}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{line.name}</td>
                  <td className="py-3.5 px-4 font-mono tabular-nums">{line.trolleyCount}</td>
                  <td className="py-3.5 px-4 font-mono tabular-nums">{line.breakdowns}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge label={line.pmRate} tone="emerald" />
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums">
                    {line.avgTat === '—' ? '—' : `${line.avgTat} d`}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500 tabular-nums">
                    {line.targetTat}
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
