import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  History,
  Boxes,
  Wrench,
  CalendarCheck2,
  Users,
  ShieldAlert,
  Factory,
  BarChart3,
  QrCode,
  Bell,
  Globe,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  activeFirebaseTarget,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './services/firebase';
import { seedAcceloDatabaseIfEmpty } from './services/seedData';
import {
  AppNotification,
  Asset,
  AuditLog,
  Language,
  ManpowerRecord,
  NavPage,
  PreventiveMaintenance,
  SafetyIncident,
  Shop,
  UserProfile,
  WorkOrder,
  WorkOrderLog,
} from './types';
import { getTranslation } from './i18n/translations';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MahindraAcceloLogo } from './components/MahindraAcceloLogo';
import { QrScannerModal } from './components/QrScannerModal';
import { QrLabelModal } from './components/QrLabelModal';
import { LoginView } from './pages/LoginView';
import { DashboardPage } from './pages/DashboardPage';
import { TrolleyHistoryPage } from './pages/TrolleyHistoryPage';
import { AssetsPage } from './pages/AssetsPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { PreventiveMaintenancePage } from './pages/PreventiveMaintenancePage';
import { MheSafetyPage } from './pages/MheSafetyPage';
import { ShopsManpowerPage } from './pages/ShopsManpowerPage';
import { ReportsPage } from './pages/ReportsPage';

function MainApp() {
  const [lang, setLang] = useState<Language>('en');
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [selectedShop, setSelectedShop] = useState<string>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInitializingSession, setIsInitializingSession] = useState(false);
  const [sessionSyncKey, setSessionSyncKey] = useState(0);
  const inFlightSessionRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);

  // Domain Collections
  const [shops, setShops] = useState<Shop[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrderLogs, setWorkOrderLogs] = useState<WorkOrderLog[]>([]);
  const [pmRecords, setPmRecords] = useState<PreventiveMaintenance[]>([]);
  const [manpower, setManpower] = useState<ManpowerRecord[]>([]);
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals & Trolley History Cross-Navigation
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrLabelAsset, setQrLabelAsset] = useState<Asset | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [selectedTrolleyQuery, setSelectedTrolleyQuery] = useState('TR-MASL-101');

  const t = getTranslation(lang);

  const withTimeout = <T,>(promise: Promise<T>, ms: number, stepLabel: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${stepLabel} timed out after ${Math.round(ms / 1000)}s. Verify Firestore is enabled and reachable.`));
      }, ms);
      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  const formatFirebaseError = (err: unknown): string => {
    if (!err) return 'Unknown error';
    const rawMsg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    try {
      const parsed = JSON.parse(rawMsg) as { error?: string; operationType?: string; path?: string };
      if (parsed?.error) {
        return `${parsed.operationType || 'operation'} on "${parsed.path || 'unknown'}": ${parsed.error}`;
      }
    } catch {
      // Not JSON-encoded FirestoreErrorInfo
    }
    return code && !rawMsg.includes(code) ? `${code}: ${rawMsg}` : rawMsg;
  };

  const isUatAdminEmail = (email?: string | null): boolean =>
    (email || '').trim().toLowerCase() === 'uat-admin@masl.com';

  const buildFallbackProfile = (user: FirebaseUser): UserProfile => {
    const now = new Date().toISOString();
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    const isUatAdmin = isUatAdminEmail(normalizedEmail);
    const isBootstrap = normalizedEmail === 'ahirrao.vaibhav@gmail.com' || isUatAdmin;
    return {
      uid: user.uid,
      name: isUatAdmin
        ? 'MASL UAT Admin'
        : (user.displayName || user.email?.split('@')[0] || 'MASL Operator').slice(0, 100),
      email: (isUatAdmin ? 'uat-admin@masl.com' : user.email || '').slice(0, 120),
      role: isBootstrap ? 'super_admin' : 'operator',
      department: isUatAdmin
        ? 'Plant Administration & UAT'
        : 'Maintenance & Trolley Operations',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
  };

  const initializeUserSession = useCallback(async (user: FirebaseUser, forceRetry = false) => {
    if (!forceRetry && inFlightSessionRef.current?.uid === user.uid) {
      return inFlightSessionRef.current.promise;
    }

    const run = (async () => {
      setIsInitializingSession(true);
      setAuthError(null);
      setFirestoreError(null);

      try {
        const userRef = doc(db, 'users', user.uid);
        let profile: UserProfile;

        try {
          const snap = await withTimeout(getDoc(userRef), 10000, 'Read user profile');
          if (snap.exists()) {
            const existingProfile = snap.data() as UserProfile;
            if (
              isUatAdminEmail(user.email) &&
              (existingProfile.role !== 'super_admin' ||
                existingProfile.name !== 'MASL UAT Admin' ||
                existingProfile.status !== 'active' ||
                existingProfile.email !== 'uat-admin@masl.com')
            ) {
              const now = new Date().toISOString();
              const uatUpdates = {
                name: 'MASL UAT Admin',
                email: 'uat-admin@masl.com',
                role: 'super_admin' as const,
                department: existingProfile.department || 'Plant Administration & UAT',
                status: 'active' as const,
                updatedAt: now,
              };
              await withTimeout(
                updateDoc(userRef, uatUpdates),
                10000,
                'Update UAT Admin profile'
              );
              profile = { ...existingProfile, ...uatUpdates };
            } else {
              profile = existingProfile;
            }
          } else {
            profile = buildFallbackProfile(user);
            await withTimeout(setDoc(userRef, profile), 10000, 'Create user profile');
          }
          setCurrentUser(profile);
        } catch (profileErr) {
          const formatted = formatFirebaseError(profileErr);
          console.error('Firestore user profile setup failed:', profileErr);
          const unverifiedNote =
            !user.emailVerified && formatted.toLowerCase().includes('permission')
              ? ' (Note: Ensure this email account is verified in Firebase Authentication to allow Firestore writes.)'
              : '';
          setFirestoreError(
            `Firestore user profile setup failed (users/${user.uid}) on project "${activeFirebaseTarget.projectId}" / database "${activeFirebaseTarget.databaseId}": ${formatted}${unverifiedNote}`
          );
          // Advance authenticated user into the workspace with a local session profile so the error is clearly visible and retryable
          setCurrentUser(buildFallbackProfile(user));
          return;
        }

        // Seed initial Mahindra Auto Steel Private Limited (MASL) fleet data if empty
        try {
          await withTimeout(
            seedAcceloDatabaseIfEmpty(
              user.uid,
              user.displayName || user.email || 'MASL Engineer'
            ),
            15000,
            'Seed initial MASL fleet data'
          );
        } catch (seedErr) {
          const formatted = formatFirebaseError(seedErr);
          console.error('Firestore fleet seed error:', seedErr);
          setFirestoreError(
            `Firestore initial fleet seed failed on project "${activeFirebaseTarget.projectId}" / database "${activeFirebaseTarget.databaseId}": ${formatted}`
          );
        }
      } finally {
        if (inFlightSessionRef.current?.uid === user.uid) {
          inFlightSessionRef.current = null;
        }
        setIsInitializingSession(false);
        setAuthReady(true);
      }
    })();

    inFlightSessionRef.current = { uid: user.uid, promise: run };
    return run;
  }, []);

  useEffect(() => {
    testConnection().then((ok) => {
      if (!ok) {
        setFirestoreError(
          `Firestore client appears offline or unreachable for project "${activeFirebaseTarget.projectId}" (database "${activeFirebaseTarget.databaseId}").`
        );
      }
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        inFlightSessionRef.current = null;
        setCurrentUser(null);
        setFirestoreError(null);
        setIsInitializingSession(false);
        setAuthReady(true);
        return;
      }

      await initializeUserSession(user);
    });

    return () => unsub();
  }, [initializeUserSession]);

  // Real-time Firestore Subscriptions (gated on authenticated user)
  useEffect(() => {
    if (!authReady || !firebaseUser || !currentUser) return;

    const handleSnapshotError = (err: unknown, path: string) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrappedErr) {
        const msg = formatFirebaseError(wrappedErr);
        setFirestoreError((prev) =>
          prev || `Firestore subscription failed on "${path}" (project "${activeFirebaseTarget.projectId}" / database "${activeFirebaseTarget.databaseId}"): ${msg}`
        );
      }
    };

    const unsubs = [
      onSnapshot(
        collection(db, 'shops'),
        (snap) => setShops(snap.docs.map((d) => d.data() as Shop)),
        (err) => handleSnapshotError(err, 'shops')
      ),
      onSnapshot(
        collection(db, 'assets'),
        (snap) => setAssets(snap.docs.map((d) => d.data() as Asset)),
        (err) => handleSnapshotError(err, 'assets')
      ),
      onSnapshot(
        collection(db, 'work_orders'),
        (snap) => setWorkOrders(snap.docs.map((d) => d.data() as WorkOrder)),
        (err) => handleSnapshotError(err, 'work_orders')
      ),
      onSnapshot(
        collection(db, 'work_order_logs'),
        (snap) => setWorkOrderLogs(snap.docs.map((d) => d.data() as WorkOrderLog)),
        (err) => handleSnapshotError(err, 'work_order_logs')
      ),
      onSnapshot(
        collection(db, 'preventive_maintenance'),
        (snap) => setPmRecords(snap.docs.map((d) => d.data() as PreventiveMaintenance)),
        (err) => handleSnapshotError(err, 'preventive_maintenance')
      ),
      onSnapshot(
        collection(db, 'manpower'),
        (snap) => setManpower(snap.docs.map((d) => d.data() as ManpowerRecord)),
        (err) => handleSnapshotError(err, 'manpower')
      ),
      onSnapshot(
        collection(db, 'safety_incidents'),
        (snap) => setSafetyIncidents(snap.docs.map((d) => d.data() as SafetyIncident)),
        (err) => handleSnapshotError(err, 'safety_incidents')
      ),
      onSnapshot(
        collection(db, 'audit_logs'),
        (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLog)),
        (err) => handleSnapshotError(err, 'audit_logs')
      ),
      onSnapshot(
        query(
          collection(db, 'notifications'),
          where('recipientUid', 'in', [firebaseUser.uid, 'all'])
        ),
        (snap) => setNotifications(snap.docs.map((d) => d.data() as AppNotification)),
        (err) => handleSnapshotError(err, 'notifications')
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [authReady, firebaseUser, currentUser, sessionSyncKey]);

  // Live sidebar notification badges (respecting selectedShop filter)
  const badges = useMemo(() => {
    const lineWOs =
      selectedShop === 'ALL' ? workOrders : workOrders.filter((w) => w.shopCode === selectedShop);
    const openWOs = lineWOs.filter(
      (w) => !['Completed', 'Closed', 'Cancelled', 'Rejected'].includes(w.status)
    ).length;

    const linePMs =
      selectedShop === 'ALL' ? pmRecords : pmRecords.filter((p) => p.shopCode === selectedShop);
    const dueOrOverduePMs = linePMs.filter(
      (p) => p.status === 'Overdue' || p.status === 'Scheduled'
    ).length;

    const lineSafety =
      selectedShop === 'ALL'
        ? safetyIncidents
        : safetyIncidents.filter((s) => s.shopCode === selectedShop);
    const openSafety = lineSafety.filter((s) => s.status !== 'Resolved & Cleared').length;

    return { openWOs, dueOrOverduePMs, openSafety };
  }, [workOrders, pmRecords, safetyIncidents, selectedShop]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setFirestoreError(null);
    setIsSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        await initializeUserSession(cred.user);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(code && !msg.includes(code) ? `${code}: ${msg}` : msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    setAuthError(null);
    setFirestoreError(null);
    setIsSigningIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        await initializeUserSession(cred.user);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      let msg = err instanceof Error ? err.message : 'Email Sign-In failed.';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        msg = 'Invalid email or password. Please verify your credentials and try again.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (code === 'auth/operation-not-allowed') {
        msg =
          'Email/Password sign-in is not enabled in Firebase Authentication. Enable it under Authentication -> Sign-in method in the Firebase Console.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many failed sign-in attempts. Please wait a moment and try again.';
      }
      setAuthError(code && !msg.includes(code) ? `${code}: ${msg}` : msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRetryFirestoreSync = async () => {
    if (!firebaseUser) return;
    setSessionSyncKey((k) => k + 1);
    await initializeUserSession(firebaseUser, true);
  };

  const handleSignOut = async () => {
    inFlightSessionRef.current = null;
    setFirestoreError(null);
    setAuthError(null);
    await signOut(auth);
  };

  const handleInspectTrolley = (trolleyQuery: string) => {
    setSelectedTrolleyQuery(trolleyQuery);
    setActivePage('trolley-history');
    setMobileMenuOpen(false);
  };

  const handleScanResult = (decodedText: string) => {
    setSelectedTrolleyQuery(decodedText);
    setActivePage('trolley-history');
  };

  const handleMarkNotificationRead = async (notif: AppNotification) => {
    if (notif.read) return;
    try {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${notif.id}`);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-sm text-slate-300">
        {t.common.loading}
      </div>
    );
  }

  if (!firebaseUser || !currentUser) {
    return (
      <LoginView
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'en' ? 'mr' : 'en'))}
        onGoogleLogin={handleGoogleLogin}
        onEmailLogin={handleEmailLogin}
        authError={authError || firestoreError}
        isSigningIn={isSigningIn}
        isInitializing={isInitializingSession}
      />
    );
  }

  const navItems: {
    id: NavPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeTone?: 'red' | 'amber' | 'slate';
  }[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'trolley-history', label: t.nav.trolleyHistory, icon: History },
    {
      id: 'work-orders',
      label: t.nav.workOrders,
      icon: Wrench,
      badge: badges.openWOs > 0 ? badges.openWOs : undefined,
      badgeTone: 'red',
    },
    { id: 'assets', label: t.nav.assets, icon: Boxes },
    {
      id: 'pm',
      label: t.nav.pm,
      icon: CalendarCheck2,
      badge: badges.dueOrOverduePMs > 0 ? badges.dueOrOverduePMs : undefined,
      badgeTone: 'amber',
    },
    { id: 'manpower', label: t.nav.manpower, icon: Users },
    {
      id: 'safety',
      label: t.nav.safety,
      icon: ShieldAlert,
      badge: badges.openSafety > 0 ? badges.openSafety : undefined,
      badgeTone: 'red',
    },
    { id: 'shops', label: t.nav.shops, icon: Factory },
    { id: 'reports', label: t.nav.reports, icon: BarChart3 },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeNavLabel = navItems.find((n) => n.id === activePage)?.label || t.nav.dashboard;
  const userRoleLabel = t.roles[currentUser.role] || currentUser.role;

  const renderNavList = (closeDrawerOnSelect: boolean) =>
    navItems.map((item) => {
      const Icon = item.icon;
      const active = activePage === item.id;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            setActivePage(item.id);
            if (closeDrawerOnSelect) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl transition-all text-left ${
            active
              ? 'bg-[#D71920] text-white shadow-lg shadow-red-600/25 font-semibold'
              : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-3 min-w-0">
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </span>
          {typeof item.badge === 'number' && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 ${
                active
                  ? 'bg-white/20 text-white'
                  : item.badgeTone === 'amber'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}
            >
              {item.badge}
            </span>
          )}
        </button>
      );
    });

  return (
    <div className="min-h-screen bg-slate-100/80 flex">
      {/* Desktop Fixed Dark Navy Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-68 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-800/90">
          <MahindraAcceloLogo variant="light" />
        </div>

        <div className="px-4 pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2">
            Operations & Lifecycle
          </p>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">{renderNavList(false)}</nav>

        <div className="p-4 border-t border-slate-800/90 bg-slate-950/40 text-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/15 text-red-300 border border-red-500/25">
              {userRoleLabel}
            </span>
          </div>
          <p className="font-semibold text-white truncate">{currentUser.name}</p>
          <p className="text-slate-400 truncate mt-0.5">{currentUser.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.signOut}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 bg-slate-900 text-slate-200 flex flex-col h-full border-r border-slate-800">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <MahindraAcceloLogo variant="light" compact />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">{renderNavList(true)}</nav>
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
              <p className="font-semibold text-white truncate">{currentUser.name}</p>
              <p className="text-slate-400 text-[11px] mb-2">{userRoleLabel}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.signOut}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Rich Dark Top Header Bar */}
        <header className="h-16 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <MahindraAcceloLogo variant="light" compact />
            </div>
            <div className="hidden sm:flex items-center gap-2.5 text-xs whitespace-nowrap min-w-0">
              <span className="font-bold text-white tracking-tight truncate" title={t.brandName}>
                <span className="hidden 2xl:inline">{t.brandName}</span>
                <span className="2xl:hidden">{t.brandShort}</span>
              </span>
              <span className="text-slate-600" aria-hidden="true">
                /
              </span>
              <span className="text-slate-300 font-medium truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Global Processing Line Selector */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                aria-label={t.common.shop}
                className="bg-transparent text-xs font-medium text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  {t.allLines}
                </option>
                {shops.map((s) => (
                  <option key={s.id} value={s.code} className="bg-slate-900 text-white">
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] rounded-xl transition-colors whitespace-nowrap shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.common.scanQr}</span>
            </button>

            <button
              type="button"
              onClick={() => setLang((l) => (l === 'en' ? 'mr' : 'en'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-slate-300" />
              {lang === 'en' ? 'मराठी' : 'English'}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-xl text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D71920] text-white text-[10px] font-bold flex items-center justify-center tabular-nums border border-slate-900">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <span className="text-xs font-bold text-slate-900">
                      Operational Alerts ({notifications.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      {t.common.close}
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">No active alerts</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            handleMarkNotificationRead(n);
                            if (n.link) {
                              const mapped =
                                n.link === 'mhe-safety'
                                  ? 'safety'
                                  : n.link === 'shops-manpower'
                                  ? 'shops'
                                  : n.link;
                              setActivePage(mapped as NavPage);
                            }
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors ${
                            n.read ? 'opacity-65' : 'bg-red-50/40'
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right">
                <p className="text-xs font-semibold text-white leading-tight">{currentUser.name}</p>
                <p className="text-[10px] font-medium text-red-400 leading-tight">
                  {userRoleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title={t.signOut}
                className="p-2 rounded-xl text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Processing Line Filter Bar */}
        <div className="md:hidden bg-slate-900/95 border-b border-slate-800 px-4 py-2 flex items-center gap-2">
          <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
            aria-label={t.common.shop}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-100"
          >
            <option value="ALL">{t.allLines}</option>
            {shops.map((s) => (
              <option key={s.id} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {firestoreError && (
            <div
              role="alert"
              className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-[#D71920] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0">
                  <p className="font-bold text-red-950">Firestore Connection / Setup Error</p>
                  <p className="text-red-800 break-words leading-relaxed">{firestoreError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetryFirestoreSync}
                  disabled={isInitializingSession}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isInitializingSession ? 'animate-spin' : ''}`} />
                  Retry Sync
                </button>
                <button
                  type="button"
                  onClick={() => setFirestoreError(null)}
                  className="p-1.5 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activePage === 'dashboard' && (
            <DashboardPage
              lang={lang}
              selectedShop={selectedShop}
              assets={assets}
              workOrders={workOrders}
              pmRecords={pmRecords}
              safetyIncidents={safetyIncidents}
              shops={shops}
              onNavigate={setActivePage}
              onInspectTrolley={handleInspectTrolley}
              onOpenScanner={() => setScannerOpen(true)}
            />
          )}

          {activePage === 'trolley-history' && (
            <TrolleyHistoryPage
              lang={lang}
              assets={assets}
              workOrders={workOrders}
              workOrderLogs={workOrderLogs}
              pmRecords={pmRecords}
              safetyIncidents={safetyIncidents}
              auditLogs={auditLogs}
              selectedQuery={selectedTrolleyQuery}
              onSelectQuery={setSelectedTrolleyQuery}
              onOpenScanner={() => setScannerOpen(true)}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'assets' && (
            <AssetsPage
              lang={lang}
              selectedShop={selectedShop}
              assets={assets}
              shops={shops}
              currentUser={currentUser}
              onInspectTrolley={handleInspectTrolley}
              onShowQrLabel={(asset) => setQrLabelAsset(asset)}
              onOpenScanner={() => setScannerOpen(true)}
            />
          )}

          {activePage === 'work-orders' && (
            <WorkOrdersPage
              lang={lang}
              selectedShop={selectedShop}
              workOrders={workOrders}
              workOrderLogs={workOrderLogs}
              assets={assets}
              shops={shops}
              manpower={manpower}
              currentUser={currentUser}
              onInspectTrolley={handleInspectTrolley}
            />
          )}

          {activePage === 'pm' && (
            <PreventiveMaintenancePage
              lang={lang}
              selectedShop={selectedShop}
              pmRecords={pmRecords}
              assets={assets}
              currentUser={currentUser}
              onInspectTrolley={handleInspectTrolley}
            />
          )}

          {activePage === 'safety' && (
            <MheSafetyPage
              lang={lang}
              selectedShop={selectedShop}
              safetyIncidents={safetyIncidents}
              assets={assets}
              shops={shops}
              currentUser={currentUser}
              onInspectTrolley={handleInspectTrolley}
            />
          )}

          {(activePage === 'shops' || activePage === 'manpower') && (
            <ShopsManpowerPage
              lang={lang}
              selectedShop={selectedShop}
              viewMode={activePage}
              shops={shops}
              manpower={manpower}
              assets={assets}
              workOrders={workOrders}
            />
          )}

          {activePage === 'reports' && (
            <ReportsPage
              lang={lang}
              selectedShop={selectedShop}
              assets={assets}
              workOrders={workOrders}
              pmRecords={pmRecords}
              safetyIncidents={safetyIncidents}
              shops={shops}
              onInspectTrolley={handleInspectTrolley}
            />
          )}
        </main>
      </div>

      {/* Global QR Modals */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanResult}
        title={t.trolleyHistory.scanPrompt}
      />
      <QrLabelModal asset={qrLabelAsset} onClose={() => setQrLabelAsset(null)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
