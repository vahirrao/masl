import React, { useMemo, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  ShieldAlert,
  CheckCircle2,
  History,
  X,
  Lock,
} from 'lucide-react';
import { db, generateFirestoreId, handleFirestoreError, OperationType } from '../services/firebase';
import {
  Asset,
  Language,
  SafetyIncident,
  Shop,
  UserProfile,
} from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface MheSafetyPageProps {
  lang: Language;
  selectedShop: string;
  safetyIncidents: SafetyIncident[];
  assets: Asset[];
  shops: Shop[];
  currentUser: UserProfile;
  onInspectTrolley: (trolleyNumber: string) => void;
}

export const MheSafetyPage: React.FC<MheSafetyPageProps> = ({
  lang,
  selectedShop,
  safetyIncidents,
  assets,
  shops,
  currentUser,
  onInspectTrolley,
}) => {
  const t = getTranslation(lang);
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const scopedIncidents = useMemo(
    () =>
      selectedShop === 'ALL'
        ? safetyIncidents
        : safetyIncidents.filter((s) => s.shopCode === selectedShop),
    [safetyIncidents, selectedShop]
  );

  const scopedAssets = useMemo(
    () => (selectedShop === 'ALL' ? assets : assets.filter((a) => a.shopCode === selectedShop)),
    [assets, selectedShop]
  );

  const [safetyForm, setSafetyForm] = useState({
    affectedAssetId: scopedAssets[0]?.id || assets[0]?.id || '',
    severity: 'High' as SafetyIncident['severity'],
    description: '',
    actionTaken: 'Asset quarantined and tagged unsafe for immediate maintenance review.',
  });

  const handleReportSafety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyForm.description.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const asset = assets.find((a) => a.id === safetyForm.affectedAssetId);

    try {
      const id = generateFirestoreId('saf');
      const payload: SafetyIncident = {
        id,
        incidentNumber: `SAF-MASL-${new Date().getFullYear()}-${String(safetyIncidents.length + 20).padStart(3, '0')}`,
        shopCode: asset?.shopCode || shops[0]?.code || 'SL-01',
        location: asset?.location || 'Main Floor',
        severity: safetyForm.severity,
        description: safetyForm.description.trim().slice(0, 1000),
        affectedAssetId: asset?.id,
        trolleyNumber: asset?.trolleyNumber,
        actionTaken: safetyForm.actionTaken.trim().slice(0, 1000),
        status: 'Open',
        reportedBy: currentUser.name.slice(0, 100),
        reportedAt: now,
      };
      await setDoc(doc(db, 'safety_incidents', id), payload);

      if (asset && (safetyForm.severity === 'High' || safetyForm.severity === 'Critical Unsafe')) {
        await updateDoc(doc(db, 'assets', asset.id), {
          condition: 'quarantined_unsafe',
          operationalStatus: 'out_of_service',
          safetyStatus: 'unsafe_locked',
          updatedAt: now,
        });
      }

      setSafetyModalOpen(false);
      setSafetyForm({ ...safetyForm, description: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'safety_incidents');
    } finally {
      setSaving(false);
    }
  };

  const handleClearIncident = async (incident: SafetyIncident) => {
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'safety_incidents', incident.id), {
        status: 'Resolved & Cleared',
        clearedAt: now,
        actionTaken: `${incident.actionTaken || ''} Cleared by ${currentUser.name}`.trim().slice(0, 1000),
      });

      if (incident.affectedAssetId) {
        await updateDoc(doc(db, 'assets', incident.affectedAssetId), {
          condition: 'good',
          operationalStatus: 'active',
          safetyStatus: 'safe',
          updatedAt: now,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `safety_incidents/${incident.id}`);
    }
  };

  const openLockouts = scopedIncidents.filter((i) => i.status !== 'Resolved & Cleared').length;
  const resolvedIncidents = scopedIncidents.filter((i) => i.status === 'Resolved & Cleared').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {t.mheSafety.titleSafety}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.mheSafety.subtitleSafety}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSafetyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-xs whitespace-nowrap transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            {t.mheSafety.reportSafety}
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Safety Lockouts
            </p>
            <p className="text-3xl font-bold text-red-700 mt-2 tabular-nums">{openLockouts}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <Lock className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cleared Observations
            </p>
            <p className="text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
              {resolvedIncidents}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Quality Logs
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
              {scopedIncidents.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Incident #</th>
                <th className="py-3.5 px-4">{t.assets.trolleyNumber}</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4">Observation & Action</th>
                <th className="py-3.5 px-4">{t.common.status}</th>
                <th className="py-3.5 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {scopedIncidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                scopedIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {inc.incidentNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      {inc.trolleyNumber ? (
                        <button
                          type="button"
                          onClick={() => onInspectTrolley(inc.trolleyNumber!)}
                          className="font-mono font-semibold text-[#D71920] hover:underline inline-flex items-center gap-1"
                        >
                          {inc.trolleyNumber}
                          <History className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="font-mono text-slate-700">{inc.shopCode}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        label={inc.severity}
                        tone={
                          inc.severity === 'Critical Unsafe' || inc.severity === 'High'
                            ? 'red'
                            : 'amber'
                        }
                      />
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="text-slate-900 font-medium">{inc.description}</p>
                      {inc.actionTaken && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{inc.actionTaken}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge
                        label={inc.status}
                        tone={inc.status === 'Resolved & Cleared' ? 'emerald' : 'red'}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {inc.status !== 'Resolved & Cleared' && (
                        <button
                          type="button"
                          onClick={() => handleClearIncident(inc)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t.mheSafety.clearLockout}
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

      {/* Safety Modal */}
      {safetyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">{t.mheSafety.reportSafety}</h3>
              <button
                type="button"
                onClick={() => setSafetyModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleReportSafety} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Affected Trolley
                </label>
                <select
                  value={safetyForm.affectedAssetId}
                  onChange={(e) =>
                    setSafetyForm({ ...safetyForm, affectedAssetId: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.trolleyNumber} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
                <select
                  value={safetyForm.severity}
                  onChange={(e) =>
                    setSafetyForm({
                      ...safetyForm,
                      severity: e.target.value as SafetyIncident['severity'],
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical Unsafe">Critical Unsafe (Auto-Lockout)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Safety Hazard Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={safetyForm.description}
                  onChange={(e) => setSafetyForm({ ...safetyForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSafetyModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl"
                >
                  {saving ? 'Submitting...' : t.common.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
