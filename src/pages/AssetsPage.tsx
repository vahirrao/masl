import React, { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, QrCode, Search, History, Edit2, X } from 'lucide-react';
import { db, generateFirestoreId, handleFirestoreError, OperationType } from '../services/firebase';
import { Asset, AssetCondition, Language, OperationalStatus, SafetyStatus, Shop, UserProfile } from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface AssetsPageProps {
  lang: Language;
  selectedShop: string;
  assets: Asset[];
  shops: Shop[];
  currentUser: UserProfile;
  onInspectTrolley: (trolleyNumber: string) => void;
  onShowQrLabel: (asset: Asset) => void;
  onOpenScanner: () => void;
}

export const AssetsPage: React.FC<AssetsPageProps> = ({
  lang,
  selectedShop,
  assets,
  shops,
  currentUser,
  onInspectTrolley,
  onShowQrLabel,
  onOpenScanner,
}) => {
  const t = getTranslation(lang);
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState(selectedShop);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShopFilter(selectedShop);
  }, [selectedShop]);

  const [form, setForm] = useState({
    trolleyNumber: '',
    name: '',
    partNumber: '',
    trolleyType: 'V-Block Coil Cradle',
    shopCode: shops[0]?.code || 'SL-01',
    location: '',
    dimensions: '',
    loadCapacityKg: 2500,
    commissioningDate: new Date().toISOString().slice(0, 10),
    condition: 'good' as AssetCondition,
    operationalStatus: 'active' as OperationalStatus,
    safetyStatus: 'safe' as SafetyStatus,
  });

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (shopFilter !== 'ALL' && a.shopCode !== shopFilter) return false;
      if (statusFilter !== 'ALL' && a.operationalStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        a.trolleyNumber.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.qrCode.toLowerCase().includes(q) ||
        (a.partNumber && a.partNumber.toLowerCase().includes(q))
      );
    });
  }, [assets, search, shopFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingAsset(null);
    setForm({
      trolleyNumber: `TR-MASL-${String(assets.length + 101).padStart(3, '0')}`,
      name: '',
      partNumber: '',
      trolleyType: 'V-Block Coil Cradle',
      shopCode: shops[0]?.code || 'SL-01',
      location: '',
      dimensions: '2200 x 1200 x 750 mm',
      loadCapacityKg: 2500,
      commissioningDate: new Date().toISOString().slice(0, 10),
      condition: 'good',
      operationalStatus: 'active',
      safetyStatus: 'safe',
    });
    setModalOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setForm({
      trolleyNumber: asset.trolleyNumber,
      name: asset.name,
      partNumber: asset.partNumber || '',
      trolleyType: asset.trolleyType || 'Industrial Trolley',
      shopCode: asset.shopCode,
      location: asset.location || '',
      dimensions: asset.dimensions || '',
      loadCapacityKg: asset.loadCapacityKg || 2000,
      commissioningDate: asset.commissioningDate || asset.createdAt.slice(0, 10),
      condition: asset.condition,
      operationalStatus: asset.operationalStatus,
      safetyStatus: asset.safetyStatus,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trolleyNumber.trim() || !form.name.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();

    try {
      if (editingAsset) {
        const ref = doc(db, 'assets', editingAsset.id);
        await updateDoc(ref, {
          name: form.name.trim().slice(0, 120),
          partNumber: form.partNumber.trim().slice(0, 60),
          trolleyType: form.trolleyType.trim().slice(0, 80),
          shopCode: form.shopCode.trim().slice(0, 30),
          location: form.location.trim().slice(0, 100),
          dimensions: form.dimensions.trim().slice(0, 80),
          loadCapacityKg: Number(form.loadCapacityKg) || 2000,
          condition: form.condition,
          operationalStatus: form.operationalStatus,
          safetyStatus: form.safetyStatus,
          updatedAt: now,
        });
      } else {
        const newId = generateFirestoreId('asset');
        const qrCode = `MASL-QR-${form.trolleyNumber.trim().toUpperCase()}`.slice(0, 100);
        const payload: Asset = {
          id: newId,
          qrCode,
          trolleyNumber: form.trolleyNumber.trim().toUpperCase().slice(0, 60),
          name: form.name.trim().slice(0, 120),
          category: 'Trolley',
          trolleyType: form.trolleyType.trim().slice(0, 80),
          shopCode: form.shopCode.trim().slice(0, 30),
          location: form.location.trim().slice(0, 100),
          partNumber: form.partNumber.trim().slice(0, 60),
          dimensions: form.dimensions.trim().slice(0, 80),
          loadCapacityKg: Number(form.loadCapacityKg) || 2000,
          condition: form.condition,
          operationalStatus: form.operationalStatus,
          safetyStatus: form.safetyStatus,
          commissioningDate: form.commissioningDate.slice(0, 40),
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(doc(db, 'assets', newId), payload);

        const audId = generateFirestoreId('aud');
        await setDoc(doc(db, 'audit_logs', audId), {
          id: audId,
          entityType: 'Asset',
          entityId: newId,
          action: 'Commissioned Trolley',
          performedByUid: currentUser.uid,
          performedByName: currentUser.name.slice(0, 100),
          performedByRole: currentUser.role,
          details: `Registered ${payload.trolleyNumber} (${payload.name}) at ${payload.shopCode}.`,
          timestamp: now,
        });
      }
      setModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingAsset ? OperationType.UPDATE : OperationType.CREATE, 'assets');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t.assets.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.assets.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap shadow-2xs"
          >
            <QrCode className="w-4 h-4 text-[#D71920]" />
            {t.common.scanQr}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t.assets.addAsset}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Trolley No., Name, Part No., or QR..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920]"
          />
        </div>
        <select
          value={shopFilter}
          onChange={(e) => setShopFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="ALL">{t.allLines}</option>
          {shops.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="ALL">{t.common.all} Statuses</option>
          <option value="active">{t.statusLabels.active}</option>
          <option value="under_maintenance">{t.statusLabels.under_maintenance}</option>
          <option value="out_of_service">{t.statusLabels.out_of_service}</option>
          <option value="scrapped">{t.statusLabels.scrapped}</option>
        </select>
      </div>

      {/* Assets Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                <th className="py-3 px-4">{t.assets.trolleyNumber}</th>
                <th className="py-3 px-4">{t.assets.assetName}</th>
                <th className="py-3 px-4">{t.assets.partNumber}</th>
                <th className="py-3 px-4">{t.common.shop}</th>
                <th className="py-3 px-4">{t.assets.commissioningDate}</th>
                <th className="py-3 px-4">{t.assets.operationalStatus}</th>
                <th className="py-3 px-4">{t.assets.safetyStatus}</th>
                <th className="py-3 px-4 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {t.common.noData}
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {asset.trolleyNumber}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{asset.name}</p>
                      <p className="text-[11px] text-slate-500">{asset.trolleyType}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {asset.partNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {asset.shopCode} · {asset.location || 'Bay'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 tabular-nums">
                      {asset.commissioningDate || asset.createdAt.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={t.statusLabels[asset.operationalStatus]} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={t.statusLabels[asset.safetyStatus]} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => onInspectTrolley(asset.trolleyNumber)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#D71920] bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        {t.assets.viewHistory}
                      </button>
                      <button
                        type="button"
                        onClick={() => onShowQrLabel(asset)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {t.assets.printQr}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(asset)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        aria-label="Edit trolley"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">
                {editingAsset ? `Edit ${editingAsset.trolleyNumber}` : t.assets.addAsset}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.trolleyNumber}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingAsset)}
                    value={form.trolleyNumber}
                    onChange={(e) => setForm({ ...form, trolleyNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.partNumber}
                  </label>
                  <input
                    type="text"
                    value={form.partNumber}
                    onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                    placeholder="e.g. MASL-COIL-4500"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t.assets.assetName}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Heavy Coil Transfer Trolley #7"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.common.shop}
                  </label>
                  <select
                    value={form.shopCode}
                    onChange={(e) => setForm({ ...form, shopCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.common.location}
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Slitter Exit Track 1"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.trolleyType}
                  </label>
                  <input
                    type="text"
                    value={form.trolleyType}
                    onChange={(e) => setForm({ ...form, trolleyType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.loadCapacity}
                  </label>
                  <input
                    type="number"
                    value={form.loadCapacityKg}
                    onChange={(e) => setForm({ ...form, loadCapacityKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.commissioningDate}
                  </label>
                  <input
                    type="date"
                    disabled={Boolean(editingAsset)}
                    value={form.commissioningDate}
                    onChange={(e) => setForm({ ...form, commissioningDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.condition}
                  </label>
                  <select
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as AssetCondition })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="excellent">{t.statusLabels.excellent}</option>
                    <option value="good">{t.statusLabels.good}</option>
                    <option value="needs_repair">{t.statusLabels.needs_repair}</option>
                    <option value="critical_damage">{t.statusLabels.critical_damage}</option>
                    <option value="quarantined_unsafe">{t.statusLabels.quarantined_unsafe}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.operationalStatus}
                  </label>
                  <select
                    value={form.operationalStatus}
                    onChange={(e) =>
                      setForm({ ...form, operationalStatus: e.target.value as OperationalStatus })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">{t.statusLabels.active}</option>
                    <option value="under_maintenance">{t.statusLabels.under_maintenance}</option>
                    <option value="out_of_service">{t.statusLabels.out_of_service}</option>
                    <option value="scrapped">{t.statusLabels.scrapped}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t.assets.safetyStatus}
                  </label>
                  <select
                    value={form.safetyStatus}
                    onChange={(e) =>
                      setForm({ ...form, safetyStatus: e.target.value as SafetyStatus })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="safe">{t.statusLabels.safe}</option>
                    <option value="pending_inspection">{t.statusLabels.pending_inspection}</option>
                    <option value="unsafe_locked">{t.statusLabels.unsafe_locked}</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Saving...' : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
