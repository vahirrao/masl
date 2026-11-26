import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Search,
  QrCode,
  History,
  CalendarClock,
  Wrench,
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  FileDown,
  ArrowUpRight,
  Clock,
  Table2,
  GitCommitHorizontal,
} from 'lucide-react';
import {
  Asset,
  WorkOrder,
  WorkOrderLog,
  PreventiveMaintenance,
  SafetyIncident,
  AuditLog,
  Language,
  NavPage,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface TrolleyHistoryPageProps {
  lang: Language;
  assets: Asset[];
  workOrders: WorkOrder[];
  workOrderLogs: WorkOrderLog[];
  pmRecords: PreventiveMaintenance[];
  safetyIncidents: SafetyIncident[];
  auditLogs: AuditLog[];
  selectedQuery: string;
  onSelectQuery: (query: string) => void;
  onOpenScanner: () => void;
  onNavigate: (page: NavPage) => void;
}

type TimelineFilter = 'all' | 'pm' | 'breakdowns' | 'safety';
type ViewDisplayMode = 'timeline' | 'table';

interface TimelineEvent {
  id: string;
  timestamp: string;
  displayDate: string;
  category:
    | 'commissioning'
    | 'pm'
    | 'first_breakdown'
    | 'breakdown'
    | 'maintenance'
    | 'repair_log'
    | 'safety'
    | 'audit';
  title: string;
  subtitle: string;
  description: string;
  meta: { label: string; value: string }[];
  statusLabel?: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  nestedLogs?: WorkOrderLog[];
}

function formatDateDisplay(isoOrDate?: string): string {
  if (!isoOrDate) return '—';
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: isoOrDate.includes('T') ? '2-digit' : undefined,
    minute: isoOrDate.includes('T') ? '2-digit' : undefined,
  });
}

export const TrolleyHistoryPage: React.FC<TrolleyHistoryPageProps> = ({
  lang,
  assets,
  workOrders,
  workOrderLogs,
  pmRecords,
  safetyIncidents,
  auditLogs,
  selectedQuery,
  onSelectQuery,
  onOpenScanner,
  onNavigate,
}) => {
  const t = getTranslation(lang);
  const [inputValue, setInputValue] = useState(selectedQuery);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [displayMode, setDisplayMode] = useState<ViewDisplayMode>('timeline');

  useEffect(() => {
    setInputValue(selectedQuery);
  }, [selectedQuery]);

  const matchedAsset = useMemo(() => {
    const q = selectedQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      assets.find(
        (a) =>
          a.trolleyNumber.toLowerCase() === q ||
          a.qrCode.toLowerCase() === q ||
          (a.partNumber && a.partNumber.toLowerCase() === q) ||
          a.id.toLowerCase() === q
      ) ||
      assets.find(
        (a) =>
          a.trolleyNumber.toLowerCase().includes(q) ||
          a.qrCode.toLowerCase().includes(q) ||
          (a.partNumber && a.partNumber.toLowerCase().includes(q)) ||
          a.name.toLowerCase().includes(q)
      ) ||
      null
    );
  }, [assets, selectedQuery]);

  const trolleyLifecycle = useMemo(() => {
    if (!matchedAsset) return null;

    const assetPMs = pmRecords
      .filter((p) => p.assetId === matchedAsset.id || p.trolleyNumber === matchedAsset.trolleyNumber)
      .sort((a, b) =>
        (a.completedDate || a.scheduledDate || '').localeCompare(
          b.completedDate || b.scheduledDate || ''
        )
      );

    const assetWOs = workOrders
      .filter((w) => w.assetId === matchedAsset.id || w.trolleyNumber === matchedAsset.trolleyNumber)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const breakdowns = assetWOs.filter(
      (w) => w.isBreakdown || w.activityType === 'Repair' || w.activityType === 'Welding'
    );
    const firstBreakdown = breakdowns.length > 0 ? breakdowns[0] : null;

    const assetLogs = workOrderLogs.filter(
      (l) =>
        l.assetId === matchedAsset.id ||
        l.trolleyNumber === matchedAsset.trolleyNumber ||
        assetWOs.some((w) => w.id === l.workOrderId)
    );

    const assetSafety = safetyIncidents.filter(
      (s) => s.affectedAssetId === matchedAsset.id || s.trolleyNumber === matchedAsset.trolleyNumber
    );

    const assetAudits = auditLogs.filter((a) => a.entityId === matchedAsset.id);

    const commissionedAt = matchedAsset.commissioningDate || matchedAsset.createdAt;
    const daysInService = Math.max(
      0,
      Math.floor((Date.now() - new Date(commissionedAt).getTime()) / (1000 * 60 * 60 * 24))
    );

    const events: TimelineEvent[] = [];

    events.push({
      id: `comm_${matchedAsset.id}`,
      timestamp: commissionedAt.includes('T') ? commissionedAt : `${commissionedAt}T08:00:00.000Z`,
      displayDate: formatDateDisplay(commissionedAt),
      category: 'commissioning',
      title: t.trolleyHistory.eventCommissioned,
      subtitle: `${matchedAsset.trolleyNumber} · ${matchedAsset.shopCode}`,
      description: `Commissioned ${matchedAsset.name} (${matchedAsset.trolleyType || 'Industrial Trolley'})${
        matchedAsset.partNumber ? ` for Part ${matchedAsset.partNumber}` : ''
      }.`,
      meta: [
        { label: t.trolleyHistory.qrTag, value: matchedAsset.qrCode },
        {
          label: t.trolleyHistory.loadCapacity,
          value: matchedAsset.loadCapacityKg ? `${matchedAsset.loadCapacityKg} kg` : '—',
        },
      ],
      statusLabel: 'Commissioned',
      tone: 'neutral',
    });

    assetPMs.forEach((pm) => {
      const pmTime = pm.completedDate || pm.scheduledDate || `${pm.year}-01-01`;
      const checkedCount = pm.checklist?.filter((c) => c.checked).length || 0;
      const totalChecks = pm.checklist?.length || 0;
      events.push({
        id: pm.id,
        timestamp: pmTime.includes('T') ? pmTime : `${pmTime}T10:00:00.000Z`,
        displayDate: formatDateDisplay(pm.completedDate || pm.scheduledDate),
        category: 'pm',
        title: `${t.trolleyHistory.eventPm} · ${pm.quarter} ${pm.year}`,
        subtitle: pm.assignedTeam || 'Maintenance Team',
        description:
          pm.technicianRemarks ||
          `Quarterly PM inspection ${pm.status.toLowerCase()} for ${pm.trolleyNumber}.`,
        meta: [
          { label: t.common.status, value: pm.status },
          ...(totalChecks > 0
            ? [{ label: 'Checklist', value: `${checkedCount}/${totalChecks} verified` }]
            : []),
          ...(pm.verifiedBySupervisor
            ? [{ label: t.trolleyHistory.verifiedBy, value: pm.verifiedBySupervisor }]
            : []),
          ...(pm.conditionPostPM
            ? [{ label: t.pm.postCondition, value: pm.conditionPostPM.replace('_', ' ') }]
            : []),
        ],
        statusLabel: pm.status,
        tone:
          pm.status === 'Completed'
            ? 'success'
            : pm.status === 'Overdue'
            ? 'danger'
            : 'warning',
      });
    });

    assetWOs.forEach((wo) => {
      const isFirstBd = firstBreakdown && wo.id === firstBreakdown.id;
      const isBd = Boolean(wo.isBreakdown || wo.activityType === 'Repair');
      const woLogs = assetLogs
        .filter((l) => l.workOrderId === wo.id)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      events.push({
        id: wo.id,
        timestamp: wo.createdAt,
        displayDate: formatDateDisplay(wo.createdAt),
        category: isFirstBd ? 'first_breakdown' : isBd ? 'breakdown' : 'maintenance',
        title: isFirstBd
          ? `${t.trolleyHistory.eventFirstBreakdown} · ${wo.workOrderNumber}`
          : isBd
          ? `${t.trolleyHistory.eventSubsequentBreakdown} · ${wo.workOrderNumber}`
          : `${t.trolleyHistory.eventMaintenanceWo} · ${wo.workOrderNumber}`,
        subtitle: `${wo.failureType || wo.activityType} · ${wo.priority} Priority`,
        description: wo.jobDescription,
        meta: [
          { label: t.common.status, value: wo.status },
          ...(wo.failureType
            ? [{ label: t.trolleyHistory.failureTypeLabel, value: wo.failureType }]
            : []),
          ...(wo.startedAt
            ? [{ label: t.trolleyHistory.startedTimestamp, value: formatDateDisplay(wo.startedAt) }]
            : []),
          ...(wo.completedAt
            ? [{ label: t.trolleyHistory.repairTimestamp, value: formatDateDisplay(wo.completedAt) }]
            : []),
          ...(typeof wo.turnaroundDays === 'number'
            ? [{ label: t.trolleyHistory.turnaroundLabel, value: `${wo.turnaroundDays} d` }]
            : []),
          ...(wo.assignedTechnicianNames && wo.assignedTechnicianNames.length > 0
            ? [{ label: t.trolleyHistory.teamLabel, value: wo.assignedTechnicianNames.join(', ') }]
            : []),
        ],
        statusLabel: wo.status,
        tone:
          isFirstBd || wo.priority === 'Critical'
            ? 'danger'
            : wo.completedAt
            ? 'success'
            : 'warning',
        nestedLogs: woLogs,
      });
    });

    assetSafety.forEach((saf) => {
      const ts = saf.reportedAt || new Date().toISOString();
      events.push({
        id: saf.id,
        timestamp: ts,
        displayDate: formatDateDisplay(saf.reportedAt),
        category: 'safety',
        title: `${t.trolleyHistory.eventSafety} · ${saf.incidentNumber}`,
        subtitle: `${saf.severity} · ${saf.location || saf.shopCode}`,
        description: `${saf.description}${saf.actionTaken ? ` — Action: ${saf.actionTaken}` : ''}`,
        meta: [
          { label: t.common.status, value: saf.status },
          ...(saf.clearedAt ? [{ label: 'Cleared', value: formatDateDisplay(saf.clearedAt) }] : []),
        ],
        statusLabel: saf.status,
        tone: saf.status === 'Resolved & Cleared' ? 'success' : 'danger',
      });
    });

    assetAudits.forEach((aud) => {
      if (aud.action.toLowerCase().includes('commissioned')) return;
      events.push({
        id: aud.id,
        timestamp: aud.timestamp,
        displayDate: formatDateDisplay(aud.timestamp),
        category: 'audit',
        title: `${t.trolleyHistory.eventAudit} · ${aud.action}`,
        subtitle: aud.performedByName || 'Operator',
        description: aud.details || aud.action,
        meta: [{ label: 'Actor', value: aud.performedByName || aud.performedByUid }],
        statusLabel: 'Logged',
        tone: 'neutral',
      });
    });

    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return {
      commissionedAt,
      daysInService,
      completedPMCount: assetPMs.filter((p) => p.status === 'Completed').length,
      totalPMCount: assetPMs.length,
      firstBreakdown,
      totalBreakdowns: breakdowns.length,
      events,
    };
  }, [matchedAsset, pmRecords, workOrders, workOrderLogs, safetyIncidents, auditLogs, t]);

  const filteredEvents = useMemo(() => {
    if (!trolleyLifecycle) return [];
    if (filter === 'all') return trolleyLifecycle.events;
    if (filter === 'pm') return trolleyLifecycle.events.filter((e) => e.category === 'pm');
    if (filter === 'breakdowns') {
      return trolleyLifecycle.events.filter((e) =>
        ['first_breakdown', 'breakdown', 'maintenance', 'repair_log'].includes(e.category)
      );
    }
    return trolleyLifecycle.events.filter((e) =>
      ['commissioning', 'safety', 'audit'].includes(e.category)
    );
  }, [trolleyLifecycle, filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSelectQuery(inputValue.trim());
  };

  const handleExportDossierPdf = () => {
    if (!matchedAsset || !trolleyLifecycle) return;
    const docPdf = new jsPDF();
    docPdf.setFontSize(15);
    docPdf.text('Mahindra Auto Steel Private Limited (MASL) - Trolley Lifecycle & Maintenance Dossier', 14, 18);
    docPdf.setFontSize(10);
    docPdf.text(
      `Trolley: ${matchedAsset.trolleyNumber} | Name: ${matchedAsset.name} | Line: ${matchedAsset.shopCode}`,
      14,
      26
    );
    docPdf.text(
      `Part No: ${matchedAsset.partNumber || 'N/A'} | Commissioned: ${trolleyLifecycle.commissionedAt} | Status: ${matchedAsset.operationalStatus}`,
      14,
      32
    );
    docPdf.text(
      `First Breakdown: ${
        trolleyLifecycle.firstBreakdown
          ? `${formatDateDisplay(trolleyLifecycle.firstBreakdown.createdAt)} (${
              trolleyLifecycle.firstBreakdown.failureType ||
              trolleyLifecycle.firstBreakdown.activityType
            })`
          : 'None'
      }`,
      14,
      38
    );

    autoTable(docPdf, {
      startY: 45,
      head: [['Date / Time', 'Lifecycle Event', 'Details', 'Status']],
      body: trolleyLifecycle.events.map((ev) => [
        ev.displayDate,
        ev.title,
        ev.description,
        ev.statusLabel || 'Recorded',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [215, 25, 32] },
    });

    docPdf.save(`${matchedAsset.trolleyNumber}_lifecycle_dossier.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Dark Slate Search & Scanner Command Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D71920] mb-1">
              <History className="w-3.5 h-3.5" />
              <span>{t.brandName} · Asset Audit</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {t.trolleyHistory.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 max-w-3xl">{t.trolleyHistory.subtitle}</p>
          </div>
          {matchedAsset && (
            <button
              type="button"
              onClick={handleExportDossierPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap self-start"
            >
              <FileDown className="w-4 h-4" />
              {t.trolleyHistory.exportDossier}
            </button>
          )}
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t.trolleyHistory.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920]"
            />
          </div>
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors whitespace-nowrap"
          >
            <QrCode className="w-4 h-4 text-[#D71920]" />
            {t.trolleyHistory.scanPrompt}
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-sm transition-colors whitespace-nowrap"
          >
            <History className="w-4 h-4" />
            {t.trolleyHistory.searchButton}
          </button>
        </form>

        {/* Registered Fleet Quick-Pick */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">
            {t.trolleyHistory.quickSelect}:
          </span>
          {[...assets]
            .sort((a, b) => a.trolleyNumber.localeCompare(b.trolleyNumber))
            .map((asset) => {
            const active = matchedAsset?.id === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelectQuery(asset.trolleyNumber)}
                className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {asset.trolleyNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty / Not Found States */}
      {!selectedQuery.trim() && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-2xl mx-auto shadow-xs">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">{t.trolleyHistory.emptyTitle}</h2>
          <p className="text-sm text-slate-500 mt-1.5">{t.trolleyHistory.emptyDesc}</p>
        </div>
      )}

      {selectedQuery.trim() && !matchedAsset && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-2xl mx-auto shadow-xs">
          <AlertOctagon className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">
            {t.trolleyHistory.notFoundTitle}: &ldquo;{selectedQuery}&rdquo;
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">{t.trolleyHistory.notFoundDesc}</p>
        </div>
      )}

      {/* Matched Trolley Lifecycle Dossier & Audit Trail */}
      {matchedAsset && trolleyLifecycle && (
        <>
          {/* Dossier Top Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1.5">
                  <span className="font-semibold text-slate-700">
                    {t.trolleyHistory.dossierHeader}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-700">{matchedAsset.qrCode}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-[#D71920]">
                    {matchedAsset.shopCode}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-extrabold text-slate-900">
                  {matchedAsset.trolleyNumber} — {matchedAsset.name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <StatusBadge
                  label={`${t.trolleyHistory.currentOperationalStatus}: ${
                    t.statusLabels[matchedAsset.operationalStatus]
                  }`}
                />
                <StatusBadge
                  label={`${t.trolleyHistory.safetyState}: ${
                    t.statusLabels[matchedAsset.safetyStatus]
                  }`}
                />
              </div>
            </div>

            {/* 4 High-Contrast Milestone KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 text-white">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>{t.trolleyHistory.commissioningDate}</span>
                  <CalendarClock className="w-4 h-4 text-slate-400" />
                </div>
                <p className="font-mono text-lg font-bold text-white mt-2 tabular-nums">
                  {formatDateDisplay(trolleyLifecycle.commissionedAt)}
                </p>
                <p className="text-xs text-slate-300 mt-1 tabular-nums">
                  {trolleyLifecycle.daysInService} {t.trolleyHistory.ageDays}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span>{t.trolleyHistory.pmCompletedCount}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="font-mono text-lg font-bold text-slate-900 mt-2 tabular-nums">
                  {trolleyLifecycle.completedPMCount} / {trolleyLifecycle.totalPMCount}
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  {t.trolleyHistory.nextPmDue}: {formatDateDisplay(matchedAsset.nextMaintenanceDueDate)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-red-50/70 border border-red-200">
                <div className="flex items-center justify-between text-xs font-semibold text-red-800">
                  <span>{t.trolleyHistory.firstBreakdownDate}</span>
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                </div>
                <p className="font-mono text-lg font-bold text-slate-900 mt-2 tabular-nums">
                  {trolleyLifecycle.firstBreakdown
                    ? formatDateDisplay(trolleyLifecycle.firstBreakdown.createdAt)
                    : t.trolleyHistory.firstBreakdownNone}
                </p>
                <p className="text-xs text-red-800 mt-1 truncate">
                  {trolleyLifecycle.firstBreakdown
                    ? trolleyLifecycle.firstBreakdown.failureType ||
                      trolleyLifecycle.firstBreakdown.activityType
                    : 'Nominal fleet asset'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                  <span>{t.trolleyHistory.totalBreakdowns}</span>
                  <Wrench className="w-4 h-4 text-amber-600" />
                </div>
                <p className="font-mono text-lg font-bold text-slate-900 mt-2 tabular-nums">
                  {trolleyLifecycle.totalBreakdowns}
                </p>
                <p className="text-xs text-amber-900 mt-1">
                  {t.trolleyHistory.conditionState}: {t.statusLabels[matchedAsset.condition]}
                </p>
              </div>
            </div>

            {/* Technical Specs Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <p className="text-slate-500">{t.trolleyHistory.partNumber}</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">
                  {matchedAsset.partNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{t.trolleyHistory.trolleyType}</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {matchedAsset.trolleyType || matchedAsset.category || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{t.trolleyHistory.dimensions}</p>
                <p className="font-mono text-slate-900 mt-0.5">{matchedAsset.dimensions || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">{t.trolleyHistory.loadCapacity}</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                  {matchedAsset.loadCapacityKg ? `${matchedAsset.loadCapacityKg} kg` : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">{t.common.location}</p>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {matchedAsset.location || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Chronological Timeline & Audit Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#D71920]" />
                <h3 className="text-base font-bold text-slate-900">
                  {displayMode === 'timeline'
                    ? t.trolleyHistory.timelineTitle
                    : t.trolleyHistory.tableViewTitle}
                </h3>
                <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                  ({filteredEvents.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      ['all', t.trolleyHistory.filterAll],
                      ['pm', t.trolleyHistory.filterPm],
                      ['breakdowns', t.trolleyHistory.filterBreakdowns],
                      ['safety', t.trolleyHistory.filterSafety],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        filter === key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('timeline')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      displayMode === 'timeline'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GitCommitHorizontal className="w-3.5 h-3.5" />
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('table')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      displayMode === 'table'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    Ledger
                  </button>
                </div>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">{t.common.noData}</div>
            ) : displayMode === 'table' ? (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                      <th className="py-3 px-4">{t.common.date}</th>
                      <th className="py-3 px-4">Lifecycle Event</th>
                      <th className="py-3 px-4">Failure / Team</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">{t.common.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {ev.displayDate}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{ev.title}</td>
                        <td className="py-3 px-4 text-slate-600">{ev.subtitle}</td>
                        <td className="py-3 px-4 text-slate-700 max-w-md">{ev.description}</td>
                        <td className="py-3 px-4">
                          <StatusBadge
                            label={ev.statusLabel || 'Recorded'}
                            tone={
                              ev.tone === 'danger'
                                ? 'red'
                                : ev.tone === 'success'
                                ? 'emerald'
                                : ev.tone === 'warning'
                                ? 'amber'
                                : 'slate'
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-2.5 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {filteredEvents.map((ev) => {
                  const iconColor =
                    ev.tone === 'danger'
                      ? 'bg-red-600 text-white'
                      : ev.tone === 'success'
                      ? 'bg-emerald-600 text-white'
                      : ev.tone === 'warning'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-white';

                  return (
                    <div key={ev.id} className="relative">
                      <div
                        className={`absolute -left-6 sm:-left-8 top-1 w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center ring-4 ring-white ${iconColor}`}
                      >
                        {ev.category === 'pm' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : ev.category === 'first_breakdown' || ev.category === 'breakdown' ? (
                          <Wrench className="w-3.5 h-3.5" />
                        ) : ev.category === 'safety' ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : (
                          <CalendarClock className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                              {ev.statusLabel && (
                                <StatusBadge
                                  label={ev.statusLabel}
                                  tone={
                                    ev.tone === 'danger'
                                      ? 'red'
                                      : ev.tone === 'success'
                                      ? 'emerald'
                                      : ev.tone === 'warning'
                                      ? 'amber'
                                      : 'slate'
                                  }
                                />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{ev.subtitle}</p>
                          </div>
                          <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                            {ev.displayDate}
                          </span>
                        </div>

                        <p className="text-sm text-slate-700 mt-2.5 leading-relaxed">
                          {ev.description}
                        </p>

                        {ev.meta.length > 0 && (
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 pt-3 border-t border-slate-100 text-xs">
                            {ev.meta.map((m) => (
                              <div key={m.label}>
                                <span className="text-slate-500">{m.label}: </span>
                                <span className="font-semibold text-slate-800">{m.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {ev.nestedLogs && ev.nestedLogs.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-700">
                                {t.trolleyHistory.eventRepairAction} ({ev.nestedLogs.length})
                              </p>
                              <button
                                type="button"
                                onClick={() => onNavigate('work-orders')}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#D71920] hover:underline"
                              >
                                {t.trolleyHistory.viewFullWo}
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              {ev.nestedLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-900">
                                      {log.action}
                                    </span>
                                    {log.statusTo && (
                                      <span className="text-slate-500"> · {log.statusTo}</span>
                                    )}
                                    {log.remarks && (
                                      <p className="text-slate-600 mt-0.5">{log.remarks}</p>
                                    )}
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                    {formatDateDisplay(log.timestamp)} ·{' '}
                                    {log.performedByName || 'Technician'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
