import React, { useMemo, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  CalendarCheck2,
  CheckSquare,
  Plus,
  History,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { db, generateFirestoreId, handleFirestoreError, OperationType } from '../services/firebase';
import {
  Asset,
  Language,
  PMChecklistItem,
  PreventiveMaintenance,
  UserProfile,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface PreventiveMaintenancePageProps {
  lang: Language;
  selectedShop: string;
  pmRecords: PreventiveMaintenance[];
  assets: Asset[];
  currentUser: UserProfile;
  onInspectTrolley: (trolleyNumber: string) => void;
}

const DEFAULT_CHECKLIST: PMChecklistItem[] = [
  { item: 'Caster wheels & swivel bearings greased', checked: false },
  { item: 'Structural chassis & gusset welds inspected', checked: false },
  { item: 'Locking pins, latches & tow-hitch checked', checked: false },
  { item: 'Safety buffers, stops & reflectors intact', checked: false },
  { item: 'QR asset tag clean & scannable', checked: false },
];

export const PreventiveMaintenancePage: React.FC<PreventiveMaintenancePageProps> = ({
  lang,
  selectedShop,
  pmRecords,
  assets,
  currentUser,
  onInspectTrolley,
}) => {
  const t = getTranslation(lang);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [activePM, setActivePM] = useState<PreventiveMaintenance | null>(null);
  const [saving, setSaving] = useState(false);

  const scopedAssets = useMemo(
    () => (selectedShop === 'ALL' ? assets : assets.filter((a) => a.shopCode === selectedShop)),
    [assets, selectedShop]
  );

  const scopedPMs = useMemo(() => {
    return pmRecords.filter((pm) => {
      if (selectedShop !== 'ALL' && pm.shopCode !== selectedShop) return false;
      if (statusFilter !== 'ALL' && pm.status !== statusFilter) return false;
      return true;
    });
  }, [pmRecords, selectedShop, statusFilter]);

  const pmStats = useMemo(() => {
    const linePMs =
      selectedShop === 'ALL' ? pmRecords : pmRecords.filter((p) => p.shopCode === selectedShop);
    const total = linePMs.length;
    const completed = linePMs.filter((p) => p.status === 'Completed').length;
    const overdue = linePMs.filter((p) => p.status === 'Overdue').length;
    const scheduled = linePMs.filter(
      (p) => p.status === 'Scheduled' || p.status === 'In Progress'
    ).length;
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 100;
    return { total, completed, overdue, scheduled, compliance };
  }, [pmRecords, selectedShop]);

  const [newPmForm, setNewPmForm] = useState({
    assetId: scopedAssets[0]?.id || assets[0]?.id || '',
    quarter: 'Q4' as 'Q1' | 'Q2' | 'Q3' | 'Q4',
    year: new Date().getFullYear(),
    scheduledDate: new Date().toISOString().slice(0, 10),
    assignedTeam: 'Team Alpha (Nitin Pawar)',
  });

  const [checklist, setChecklist] = useState<PMChecklistItem[]>(DEFAULT_CHECKLIST);
  const [remarks, setRemarks] = useState('');
  const [postCondition, setPostCondition] = useState<'excellent' | 'good' | 'rework_needed'>('good');

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const asset = assets.find((a) => a.id === newPmForm.assetId);
    if (!asset) return;
    setSaving(true);
    try {
      const id = generateFirestoreId('pm');
      const payload: PreventiveMaintenance = {
        id,
        assetId: asset.id,
        trolleyNumber: asset.trolleyNumber,
        shopCode: asset.shopCode,
        quarter: newPmForm.quarter,
        year: Number(newPmForm.year),
        scheduledDate: newPmForm.scheduledDate,
        assignedTeam: newPmForm.assignedTeam.trim().slice(0, 100),
        status: 'Scheduled',
        checklist: DEFAULT_CHECKLIST,
      };
      await setDoc(doc(db, 'preventive_maintenance', id), payload);
      setScheduleOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'preventive_maintenance');
    } finally {
      setSaving(false);
    }
  };

  const openChecklistModal = (pm: PreventiveMaintenance) => {
    setActivePM(pm);
    setChecklist(
      pm.checklist && pm.checklist.length > 0
        ? pm.checklist.map((c) => ({ ...c }))
        : DEFAULT_CHECKLIST.map((c) => ({ ...c }))
    );
    setRemarks(pm.technicianRemarks || '');
    setPostCondition(pm.conditionPostPM || 'good');
  };

  const handleCompletePM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePM) return;
    setSaving(true);
    const completedDate = new Date().toISOString().slice(0, 10);
    const nextDue = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    try {
      await updateDoc(doc(db, 'preventive_maintenance', activePM.id), {
        status: 'Completed',
        completedDate,
        checklist,
        technicianRemarks: remarks.trim().slice(0, 800) || 'PM checklist verified.',
        verifiedBySupervisor: currentUser.name.slice(0, 100),
        conditionPostPM: postCondition,
      });

      await updateDoc(doc(db, 'assets', activePM.assetId), {
        lastMaintenanceDate: completedDate,
        nextMaintenanceDueDate: nextDue,
        maintenanceQuarter: activePM.quarter,
        condition: postCondition === 'rework_needed' ? 'needs_repair' : postCondition,
        updatedAt: new Date().toISOString(),
      });

      setActivePM(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `preventive_maintenance/${activePM.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.pm.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.pm.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewPmForm((prev) => ({
              ...prev,
              assetId: scopedAssets[0]?.id || assets[0]?.id || '',
            }));
            setScheduleOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-xs whitespace-nowrap self-start transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t.pm.schedulePm}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t.dashboard.pmCompliance}
            </p>
            <p className="text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
              {pmStats.compliance}%
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {pmStats.completed} / {pmStats.total} verified
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Cycles
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {pmStats.completed}
            </p>
            <div className="mt-1">
              <StatusBadge label="Verified" tone="emerald" />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Scheduled / Active
            </p>
            <p className="text-3xl font-bold text-amber-700 mt-2 tabular-nums">
              {pmStats.scheduled}
            </p>
            <p className="text-xs text-slate-500 mt-1">Pending technician sign-off</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue PMs
            </p>
            <p className="text-3xl font-bold text-red-700 mt-2 tabular-nums">{pmStats.overdue}</p>
            <div className="mt-1">
              <StatusBadge
                label={pmStats.overdue > 0 ? 'Action Required' : 'Zero Overdue'}
                tone={pmStats.overdue > 0 ? 'red' : 'emerald'}
              />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'Scheduled', 'In Progress', 'Completed', 'Overdue'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? t.common.all : st}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-medium tabular-nums">
          {scopedPMs.length} {t.pm.quarter} records
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">{t.assets.trolleyNumber}</th>
                <th className="py-3.5 px-4">{t.common.shop}</th>
                <th className="py-3.5 px-4">{t.pm.quarter}</th>
                <th className="py-3.5 px-4">{t.pm.scheduledDate}</th>
                <th className="py-3.5 px-4">{t.pm.completedDate}</th>
                <th className="py-3.5 px-4">{t.pm.assignedTeam}</th>
                <th className="py-3.5 px-4">{t.common.status}</th>
                <th className="py-3.5 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {scopedPMs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                scopedPMs.map((pm) => (
                  <tr key={pm.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => onInspectTrolley(pm.trolleyNumber)}
                        className="font-mono font-semibold text-[#D71920] hover:underline inline-flex items-center gap-1"
                      >
                        {pm.trolleyNumber}
                        <History className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">{pm.shopCode}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {pm.quarter} {pm.year}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                      {pm.scheduledDate || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 tabular-nums">
                      {pm.completedDate || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{pm.assignedTeam || '—'}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge label={pm.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openChecklistModal(pm)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        {pm.status === 'Completed' ? t.common.view : t.pm.completePm}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">{t.pm.schedulePm}</h3>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSchedule} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.assets.trolleyNumber}
                </label>
                <select
                  value={newPmForm.assetId}
                  onChange={(e) => setNewPmForm({ ...newPmForm, assetId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  {(scopedAssets.length > 0 ? scopedAssets : assets).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.trolleyNumber} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.pm.quarter}
                  </label>
                  <select
                    value={newPmForm.quarter}
                    onChange={(e) =>
                      setNewPmForm({
                        ...newPmForm,
                        quarter: e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.pm.scheduledDate}
                  </label>
                  <input
                    type="date"
                    value={newPmForm.scheduledDate}
                    onChange={(e) => setNewPmForm({ ...newPmForm, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.pm.assignedTeam}
                </label>
                <input
                  type="text"
                  value={newPmForm.assignedTeam}
                  onChange={(e) => setNewPmForm({ ...newPmForm, assignedTeam: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl"
                >
                  {saving ? 'Saving...' : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checklist Execution Modal */}
      {activePM && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="w-4 h-4 text-[#D71920]" />
                <h3 className="text-base font-semibold">
                  {activePM.trolleyNumber} · {activePM.quarter} {activePM.year} PM
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePM(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCompletePM} className="p-5 space-y-4">
              <div className="space-y-2">
                {checklist.map((c, idx) => (
                  <label
                    key={c.item}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={(e) => {
                        const updated = [...checklist];
                        updated[idx] = { ...c, checked: e.target.checked };
                        setChecklist(updated);
                      }}
                      className="rounded border-slate-300 text-[#D71920]"
                    />
                    <span>{c.item}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.pm.postCondition}
                </label>
                <select
                  value={postCondition}
                  onChange={(e) =>
                    setPostCondition(e.target.value as 'excellent' | 'good' | 'rework_needed')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="excellent">{t.statusLabels.excellent}</option>
                  <option value="good">{t.statusLabels.good}</option>
                  <option value="rework_needed">Rework Needed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.common.remarks}
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Inspection observations, parts lubricated, or follow-up actions..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActivePM(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                >
                  {saving ? 'Saving...' : 'Verify & Complete PM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
