import React, { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, Users, Factory, X, ShieldCheck, Wrench } from 'lucide-react';
import { db, generateFirestoreId, handleFirestoreError, OperationType } from '../services/firebase';
import { Asset, Language, ManpowerRecord, Shop, WorkOrder } from '../types';
import { getTranslation } from '../i18n/translations';
import { StatusBadge } from '../components/StatusBadge';

interface ShopsManpowerPageProps {
  lang: Language;
  selectedShop: string;
  viewMode: 'shops' | 'manpower';
  shops: Shop[];
  manpower: ManpowerRecord[];
  assets: Asset[];
  workOrders: WorkOrder[];
}

export const ShopsManpowerPage: React.FC<ShopsManpowerPageProps> = ({
  lang,
  selectedShop,
  viewMode,
  shops,
  manpower,
  assets,
  workOrders,
}) => {
  const t = getTranslation(lang);
  const [tab, setTab] = useState<'shops' | 'manpower'>(viewMode);
  const [shopModal, setShopModal] = useState(false);
  const [mpModal, setMpModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab(viewMode);
  }, [viewMode]);

  const scopedShops = useMemo(
    () => (selectedShop === 'ALL' ? shops : shops.filter((s) => s.code === selectedShop)),
    [shops, selectedShop]
  );

  const scopedManpower = useMemo(
    () =>
      selectedShop === 'ALL' ? manpower : manpower.filter((m) => m.assignedShop === selectedShop),
    [manpower, selectedShop]
  );

  const [shopForm, setShopForm] = useState({
    name: '',
    code: '',
    area: '',
    supervisorName: '',
    targetTAT: 2,
  });

  const [mpForm, setMpForm] = useState({
    employeeCode: '',
    name: '',
    designation: 'Maintenance Technician',
    primarySkill: 'Welding & Fabrication',
    assignedShop: selectedShop !== 'ALL' ? selectedShop : shops[0]?.code || 'SL-01',
    currentShift: 'Shift A (Morning)' as ManpowerRecord['currentShift'],
  });

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopForm.name.trim() || !shopForm.code.trim()) return;
    setSaving(true);
    try {
      const id = generateFirestoreId('shop');
      const payload: Shop = {
        id,
        name: shopForm.name.trim().slice(0, 100),
        code: shopForm.code.trim().toUpperCase().slice(0, 30),
        area: shopForm.area.trim().slice(0, 100),
        active: true,
        supervisorName: shopForm.supervisorName.trim().slice(0, 100),
        targetTAT: Number(shopForm.targetTAT) || 2,
      };
      await setDoc(doc(db, 'shops', id), payload);
      setShopModal(false);
      setShopForm({ name: '', code: '', area: '', supervisorName: '', targetTAT: 2 });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shops');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManpower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mpForm.name.trim() || !mpForm.employeeCode.trim()) return;
    setSaving(true);
    try {
      const id = generateFirestoreId('mp');
      const payload: ManpowerRecord = {
        id,
        employeeCode: mpForm.employeeCode.trim().toUpperCase().slice(0, 40),
        name: mpForm.name.trim().slice(0, 100),
        designation: mpForm.designation.trim().slice(0, 80),
        primarySkill: mpForm.primarySkill.trim().slice(0, 60),
        assignedShop: mpForm.assignedShop,
        currentShift: mpForm.currentShift,
        attendanceStatus: 'Present',
        activeWorkOrders: 0,
        safetyInducted: true,
      };
      await setDoc(doc(db, 'manpower', id), payload);
      setMpModal(false);
      setMpForm({ ...mpForm, employeeCode: '', name: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'manpower');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleAttendance = async (person: ManpowerRecord) => {
    const order: ManpowerRecord['attendanceStatus'][] = ['Present', 'Overtime', 'On Leave', 'Absent'];
    const next = order[(order.indexOf(person.attendanceStatus) + 1) % order.length];
    try {
      await updateDoc(doc(db, 'manpower', person.id), { attendanceStatus: next });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `manpower/${person.id}`);
    }
  };

  const presentCount = scopedManpower.filter(
    (m) => m.attendanceStatus === 'Present' || m.attendanceStatus === 'Overtime'
  ).length;
  const safetyInductedCount = scopedManpower.filter((m) => m.safetyInducted).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {tab === 'shops' ? t.shopsManpower.titleShops : t.shopsManpower.titleManpower}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tab === 'shops' ? t.shopsManpower.subtitleShops : t.shopsManpower.subtitleManpower}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setTab('shops')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'shops' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.shopsManpower.tabShops}
            </button>
            <button
              type="button"
              onClick={() => setTab('manpower')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'manpower' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.shopsManpower.tabManpower}
            </button>
          </div>
          {tab === 'shops' ? (
            <button
              type="button"
              onClick={() => setShopModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.shopsManpower.addShop}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMpModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.shopsManpower.addManpower}
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      {tab === 'manpower' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Roster
              </p>
              <p className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">
                {scopedManpower.length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active On Shift
              </p>
              <p className="text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
                {presentCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Safety Inducted
              </p>
              <p className="text-3xl font-bold text-sky-700 mt-2 tabular-nums">
                {safetyInductedCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {tab === 'shops' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scopedShops.map((shop) => {
            const shopTrolleys = assets.filter((a) => a.shopCode === shop.code).length;
            const shopOpenWOs = workOrders.filter(
              (w) =>
                w.shopCode === shop.code &&
                !['Completed', 'Closed', 'Cancelled', 'Rejected'].includes(w.status)
            ).length;
            return (
              <div
                key={shop.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 border border-red-100 font-mono text-xs font-bold text-[#D71920]">
                      {shop.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5">{shop.name}</h3>
                    <p className="text-xs text-slate-500">{shop.area || 'MASL Floor'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Factory className="w-5 h-5" />
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Trolleys</p>
                    <p className="font-mono text-base font-bold text-slate-900 tabular-nums mt-0.5">
                      {shopTrolleys}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Open Jobs</p>
                    <p className="font-mono text-base font-bold text-amber-700 tabular-nums mt-0.5">
                      {shopOpenWOs}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Target TAT</p>
                    <p className="font-mono text-base font-bold text-slate-900 tabular-nums mt-0.5">
                      {shop.targetTAT || 2}d
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Lead:{' '}
                    <span className="font-semibold text-slate-800">
                      {shop.supervisorName || 'Assigned'}
                    </span>
                  </span>
                  <StatusBadge label={shop.active ? 'Active' : 'Inactive'} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Emp Code</th>
                  <th className="py-3.5 px-4">Technician Name</th>
                  <th className="py-3.5 px-4">Primary Skill</th>
                  <th className="py-3.5 px-4">Assigned Line</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">Attendance</th>
                  <th className="py-3.5 px-4 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {scopedManpower.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      {t.common.noData}
                    </td>
                  </tr>
                ) : (
                  scopedManpower.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {m.employeeCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{m.name}</p>
                        <p className="text-[11px] text-slate-500">{m.designation}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{m.primarySkill || '—'}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                        {m.assignedShop || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{m.currentShift || 'General'}</td>
                      <td className="py-3.5 px-4">
                        <StatusBadge label={m.attendanceStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleCycleAttendance(m)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Update Shift Status
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shopModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">{t.shopsManpower.addShop}</h3>
              <button
                type="button"
                onClick={() => setShopModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddShop} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Line Code
                  </label>
                  <input
                    type="text"
                    required
                    value={shopForm.code}
                    onChange={(e) => setShopForm({ ...shopForm, code: e.target.value })}
                    placeholder="SL-02"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target TAT (Days)
                  </label>
                  <input
                    type="number"
                    value={shopForm.targetTAT}
                    onChange={(e) => setShopForm({ ...shopForm, targetTAT: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Line Name</label>
                <input
                  type="text"
                  required
                  value={shopForm.name}
                  onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  placeholder="Coil Slitting Line 2"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supervisor Name
                </label>
                <input
                  type="text"
                  value={shopForm.supervisorName}
                  onChange={(e) => setShopForm({ ...shopForm, supervisorName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShopModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#D71920] rounded-xl"
                >
                  {saving ? 'Saving...' : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
              <h3 className="text-base font-semibold">{t.shopsManpower.addManpower}</h3>
              <button
                type="button"
                onClick={() => setMpModal(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddManpower} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Employee Code
                  </label>
                  <input
                    type="text"
                    required
                    value={mpForm.employeeCode}
                    onChange={(e) => setMpForm({ ...mpForm, employeeCode: e.target.value })}
                    placeholder="MASL-MNT-112"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Line
                  </label>
                  <select
                    value={mpForm.assignedShop}
                    onChange={(e) => setMpForm({ ...mpForm, assignedShop: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={mpForm.name}
                  onChange={(e) => setMpForm({ ...mpForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Skill
                </label>
                <input
                  type="text"
                  value={mpForm.primarySkill}
                  onChange={(e) => setMpForm({ ...mpForm, primarySkill: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMpModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl"
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
