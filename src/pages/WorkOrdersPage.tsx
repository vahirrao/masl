import React, { useMemo, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, Search, Wrench, History, X, CheckCircle2 } from 'lucide-react';
import { db, generateFirestoreId, handleFirestoreError, OperationType } from '../services/firebase';
import {
  Asset,
  Language,
  ManpowerRecord,
  Shop,
  UserProfile,
  WorkOrder,
  WorkOrderActivityType,
  WorkOrderLog,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface WorkOrdersPageProps {
  lang: Language;
  selectedShop: string;
  workOrders: WorkOrder[];
  workOrderLogs: WorkOrderLog[];
  assets: Asset[];
  shops: Shop[];
  manpower: ManpowerRecord[];
  currentUser: UserProfile;
  onInspectTrolley: (trolleyNumber: string) => void;
}

const FAILURE_TYPES = [
  'Caster Wheel Bearing Seizure',
  'Polyurethane Wheel Delamination',
  'Structural Weld Crack',
  'Locking Pin / Latch Jam',
  'Frame / Mast Deflection',
  'Tow-Hitch Spring Failure',
  'Safety Buffer / Stopper Wear',
  'Surface Corrosion / Paint Peel',
];

const ACTIVITIES: WorkOrderActivityType[] = [
  'Repair',
  'Welding',
  'Fabrication',
  'Locking',
  'Painting',
  'Cleaning',
  'Resting',
  'Modification',
  'General Maintenance',
];

const WORKFLOW_STATUSES: WorkOrderStatus[] = [
  'Submitted',
  'Under Review',
  'Awaiting PE Approval',
  'Approved',
  'Assigned',
  'In Progress',
  'Awaiting Material',
  'Awaiting Inspection',
  'Completed',
  'Closed',
];

export const WorkOrdersPage: React.FC<WorkOrdersPageProps> = ({
  lang,
  selectedShop,
  workOrders,
  workOrderLogs,
  assets,
  shops,
  manpower,
  currentUser,
  onInspectTrolley,
}) => {
  const t = getTranslation(lang);
  const [search, setSearch] = useState('');
  const [breakdownOnly, setBreakdownOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    assetId: assets[0]?.id || '',
    shopCode: shops[0]?.code || 'SL-01',
    isBreakdown: true,
    failureType: FAILURE_TYPES[0],
    activityType: 'Repair' as WorkOrderActivityType,
    priority: 'High' as WorkOrderPriority,
    jobDescription: '',
    requiredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
  });

  const [progressNote, setProgressNote] = useState('');
  const [nextStatus, setNextStatus] = useState<WorkOrderStatus>('In Progress');
  const [selectedTechName, setSelectedTechName] = useState('');

  const filteredWOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...workOrders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((w) => {
        if (selectedShop !== 'ALL' && w.shopCode !== selectedShop) return false;
        if (breakdownOnly && !w.isBreakdown) return false;
        if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
        if (!q) return true;
        return (
          w.workOrderNumber.toLowerCase().includes(q) ||
          (w.trolleyNumber && w.trolleyNumber.toLowerCase().includes(q)) ||
          w.jobDescription.toLowerCase().includes(q) ||
          (w.failureType && w.failureType.toLowerCase().includes(q))
        );
      });
  }, [workOrders, search, breakdownOnly, statusFilter, selectedShop]);

  const handleCreateWO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobDescription.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const chosenAsset = assets.find((a) => a.id === form.assetId);
    const chosenShop = shops.find((s) => s.code === (chosenAsset?.shopCode || form.shopCode));

    try {
      const woId = generateFirestoreId('wo');
      const woNumber = `WO-MASL-${new Date().getFullYear()}-${String(workOrders.length + 101).padStart(3, '0')}`;
      const newWO: WorkOrder = {
        id: woId,
        workOrderNumber: woNumber,
        shopCode: chosenAsset?.shopCode || form.shopCode,
        shopName: chosenShop?.name || form.shopCode,
        location: chosenAsset?.location || 'Main Bay',
        requesterUid: currentUser.uid,
        requesterName: currentUser.name.slice(0, 100),
        assetId: chosenAsset?.id,
        trolleyNumber: chosenAsset?.trolleyNumber,
        trolleyType: chosenAsset?.trolleyType,
        partNumber: chosenAsset?.partNumber,
        isBreakdown: form.isBreakdown,
        failureType: form.isBreakdown ? form.failureType : undefined,
        jobDescription: form.jobDescription.trim().slice(0, 1000),
        activityType: form.activityType,
        priority: form.priority,
        status: 'Submitted',
        requiredDate: form.requiredDate,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'work_orders', woId), newWO);

      const logId = generateFirestoreId('wolog');
      await setDoc(doc(db, 'work_order_logs', logId), {
        id: logId,
        workOrderId: woId,
        assetId: chosenAsset?.id,
        trolleyNumber: chosenAsset?.trolleyNumber,
        action: form.isBreakdown ? 'Breakdown Reported' : 'Maintenance Job Created',
        statusFrom: 'Draft',
        statusTo: 'Submitted',
        remarks: newWO.jobDescription,
        performedByUid: currentUser.uid,
        performedByName: currentUser.name.slice(0, 100),
        performedByRole: currentUser.role,
        timestamp: now,
      });

      if (chosenAsset && form.isBreakdown) {
        await updateDoc(doc(db, 'assets', chosenAsset.id), {
          operationalStatus: 'under_maintenance',
          condition: form.priority === 'Critical' ? 'critical_damage' : 'needs_repair',
          updatedAt: now,
        });
      }

      setCreateOpen(false);
      setForm({ ...form, jobDescription: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'work_orders');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWO) return;
    setSaving(true);
    const now = new Date().toISOString();

    try {
      const updates: Partial<WorkOrder> = {
        status: nextStatus,
        updatedAt: now,
      };

      if (nextStatus === 'In Progress' && !selectedWO.startedAt) {
        updates.startedAt = now;
      }
      if ((nextStatus === 'Completed' || nextStatus === 'Closed') && !selectedWO.completedAt) {
        updates.completedAt = now;
        const startMs = new Date(selectedWO.startedAt || selectedWO.createdAt).getTime();
        const diffDays = Math.max(0.1, Number(((Date.now() - startMs) / 86400000).toFixed(1)));
        updates.turnaroundDays = diffDays;
        updates.qualityInspectionPassed = true;
      }
      if (nextStatus === 'Approved') {
        updates.peApproved = true;
      }
      if (selectedTechName) {
        updates.assignedTechnicianNames = [selectedTechName];
      }

      await updateDoc(doc(db, 'work_orders', selectedWO.id), updates);

      const logId = generateFirestoreId('wolog');
      await setDoc(doc(db, 'work_order_logs', logId), {
        id: logId,
        workOrderId: selectedWO.id,
        assetId: selectedWO.assetId,
        trolleyNumber: selectedWO.trolleyNumber,
        action: `Status updated to ${nextStatus}`,
        statusFrom: selectedWO.status,
        statusTo: nextStatus,
        remarks:
          progressNote.trim().slice(0, 1000) ||
          `Updated work order status to ${nextStatus}${selectedTechName ? ` (Assigned: ${selectedTechName})` : ''}.`,
        performedByUid: currentUser.uid,
        performedByName: currentUser.name.slice(0, 100),
        performedByRole: currentUser.role,
        timestamp: now,
      });

      if (selectedWO.assetId && (nextStatus === 'Completed' || nextStatus === 'Closed')) {
        await updateDoc(doc(db, 'assets', selectedWO.assetId), {
          operationalStatus: 'active',
          condition: 'good',
          safetyStatus: 'safe',
          updatedAt: now,
        });
      }

      setProgressNote('');
      setSelectedWO({ ...selectedWO, ...updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `work_orders/${selectedWO.id}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedLogs = useMemo(() => {
    if (!selectedWO) return [];
    return workOrderLogs
      .filter((l) => l.workOrderId === selectedWO.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [selectedWO, workOrderLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.workOrders.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.workOrders.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl whitespace-nowrap self-start shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t.workOrders.newOrder}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WO #, Trolley #, failure type, or description..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="ALL">{t.common.all} Statuses</option>
          {WORKFLOW_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setBreakdownOnly(!breakdownOnly)}
          className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
            breakdownOnly
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {t.workOrders.breakdownOnly}
        </button>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                <th className="py-3 px-4">{t.workOrders.woNumber}</th>
                <th className="py-3 px-4">{t.assets.trolleyNumber}</th>
                <th className="py-3 px-4">{t.workOrders.failureType} / Activity</th>
                <th className="py-3 px-4">{t.common.shop}</th>
                <th className="py-3 px-4">{t.common.priority}</th>
                <th className="py-3 px-4">{t.common.status}</th>
                <th className="py-3 px-4">{t.workOrders.turnaroundDays}</th>
                <th className="py-3 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredWOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredWOs.map((wo) => (
                  <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {wo.workOrderNumber}
                    </td>
                    <td className="py-3 px-4">
                      {wo.trolleyNumber ? (
                        <button
                          type="button"
                          onClick={() => onInspectTrolley(wo.trolleyNumber!)}
                          className="font-mono font-semibold text-[#D71920] hover:underline inline-flex items-center gap-1"
                        >
                          {wo.trolleyNumber}
                          <History className="w-3 h-3" />
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {wo.isBreakdown
                          ? `Breakdown · ${wo.failureType || wo.activityType}`
                          : wo.activityType}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{wo.jobDescription}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{wo.shopCode}</td>
                    <td className="py-3 px-4">
                      <StatusBadge label={wo.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={wo.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                      {typeof wo.turnaroundDays === 'number' ? `${wo.turnaroundDays} d` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWO(wo);
                          setNextStatus(
                            wo.status === 'Submitted'
                              ? 'In Progress'
                              : wo.status === 'In Progress'
                              ? 'Completed'
                              : 'Closed'
                          );
                          setSelectedTechName(wo.assignedTechnicianNames?.[0] || '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Work Order Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">{t.workOrders.newOrder}</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateWO} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.trolleyNumber}
                  </label>
                  <select
                    value={form.assetId}
                    onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.trolleyNumber} — {a.shopCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.common.priority}
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value as WorkOrderPriority })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isBreakdown}
                  onChange={(e) => setForm({ ...form, isBreakdown: e.target.checked })}
                  className="rounded border-slate-300 text-[#D71920]"
                />
                {t.workOrders.isBreakdown}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {form.isBreakdown && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t.workOrders.failureType}
                    </label>
                    <select
                      value={form.failureType}
                      onChange={(e) => setForm({ ...form, failureType: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      {FAILURE_TYPES.map((ft) => (
                        <option key={ft} value={ft}>
                          {ft}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.workOrders.activityType}
                  </label>
                  <select
                    value={form.activityType}
                    onChange={(e) =>
                      setForm({ ...form, activityType: e.target.value as WorkOrderActivityType })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {ACTIVITIES.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.workOrders.jobDescription}
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.jobDescription}
                  onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                  placeholder="Describe the failure symptom, damaged component, or required maintenance..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Submitting...' : t.common.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work Order Detail & Progress Modal */}
      {selectedWO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <div>
                <p className="font-mono text-xs text-slate-300">{selectedWO.workOrderNumber}</p>
                <h3 className="text-base font-semibold">
                  {selectedWO.trolleyNumber || selectedWO.shopCode} · {selectedWO.activityType}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWO(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">
                    {selectedWO.isBreakdown
                      ? `Breakdown: ${selectedWO.failureType || selectedWO.activityType}`
                      : selectedWO.activityType}
                  </p>
                  <StatusBadge label={selectedWO.status} />
                </div>
                <p className="text-slate-700 leading-relaxed">{selectedWO.jobDescription}</p>
              </div>

              <form onSubmit={handleUpdateProgress} className="space-y-3 border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-800">
                  {t.workOrders.updateProgress}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Next Status
                    </label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as WorkOrderStatus)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {WORKFLOW_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {t.workOrders.assignTech}
                    </label>
                    <select
                      value={selectedTechName}
                      onChange={(e) => setSelectedTechName(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Unassigned</option>
                      {manpower.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.primarySkill || m.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Enter repair action, weld check, or parts replaced..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {saving ? 'Updating...' : 'Save Progress Log'}
                  </button>
                </div>
              </form>

              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800">
                  Repair & Audit Log ({selectedLogs.length})
                </h4>
                {selectedLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">No logs recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedLogs.map((l) => (
                      <div
                        key={l.id}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">{l.action}</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {new Date(l.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {l.remarks && <p className="text-slate-600 mt-1">{l.remarks}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
