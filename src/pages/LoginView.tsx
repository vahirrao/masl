import React, { useState } from 'react';
import {
  ShieldCheck,
  Wrench,
  History,
  QrCode,
  Globe,
  AlertTriangle,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { MahindraAcceloLogo } from '../components/MahindraAcceloLogo';

interface LoginViewProps {
  lang: Language;
  onToggleLang: () => void;
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  authError: string | null;
  isSigningIn: boolean;
  isInitializing?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  lang,
  onToggleLang,
  onGoogleLogin,
  onEmailLogin,
  authError,
  isSigningIn,
  isInitializing = false,
}) => {
  const t = getTranslation(lang);
  const [imgFailed, setImgFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'email' | 'google' | null>(null);

  const busy = isSigningIn || isInitializing;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setActiveMethod('email');
    try {
      await onEmailLogin(email.trim(), password);
    } finally {
      setActiveMethod(null);
    }
  };

  const handleGoogleClick = async () => {
    if (busy) return;
    setActiveMethod('google');
    try {
      await onGoogleLogin();
    } finally {
      setActiveMethod(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12">
      {/* Left Hero Visual Column */}
      <div className="lg:col-span-7 relative bg-slate-900 overflow-hidden flex flex-col justify-between p-8 lg:p-12 min-h-[320px]">
        {!imgFailed ? (
          <img
            src="/src/assets/images/accelo_plant_backdrop_1795019183925.jpg"
            alt="Mahindra Auto Steel Private Limited (MASL) Steel Service Center & Trolley Bay"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-slate-950/40" />

        <div className="relative z-10 flex items-center justify-between">
          <MahindraAcceloLogo variant="light" />
          <button
            type="button"
            onClick={onToggleLang}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === 'en' ? 'मराठी' : 'English'}
          </button>
        </div>

        <div className="relative z-10 max-w-xl mt-12 lg:mt-0">
          <p className="text-xs font-semibold tracking-wider text-red-400 uppercase mb-3">
            {t.plantLocation}
          </p>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-white leading-tight text-balance">
            {t.appTitle}
          </h1>
          <p className="text-sm lg:text-base text-slate-300 mt-4 leading-relaxed">
            {t.loginSubtitle}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/15">
            <div className="text-slate-200">
              <QrCode className="w-4 h-4 text-red-400 mb-1.5" />
              <p className="text-xs font-medium">QR Asset Registry</p>
            </div>
            <div className="text-slate-200">
              <History className="w-4 h-4 text-red-400 mb-1.5" />
              <p className="text-xs font-medium">Lifecycle Audit</p>
            </div>
            <div className="text-slate-200">
              <Wrench className="w-4 h-4 text-red-400 mb-1.5" />
              <p className="text-xs font-medium">PM & Breakdowns</p>
            </div>
            <div className="text-slate-200">
              <ShieldCheck className="w-4 h-4 text-red-400 mb-1.5" />
              <p className="text-xs font-medium">Safety Lockouts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sign-In Column */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <MahindraAcceloLogo variant="dark" className="lg:hidden mb-4" />
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {t.brandName} Maintenance Portal
            </h2>
            <p className="text-sm text-slate-600">{t.loginPortalDesc}</p>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="font-semibold text-red-900">Sign-In / Session Setup Error</p>
                <p className="break-words leading-relaxed">{authError}</p>
              </div>
            </div>
          )}

          {/* Email & Password Sign-In Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t.emailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  disabled={busy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@masl.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920] disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t.passwordLabel}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D71920]/20 focus:border-[#D71920] disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={busy}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors shadow-xs"
            >
              {isSigningIn && activeMethod === 'email' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : isInitializing && activeMethod !== 'google' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading MASL workspace...
                </>
              ) : (
                t.signInWithEmail
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {t.orContinueWith}
            </span>
            <div className="grow border-t border-slate-200" />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleClick}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-[#D71920] hover:bg-[#B8141A] disabled:opacity-60 rounded-lg transition-colors shadow-xs"
          >
            {(isSigningIn && activeMethod === 'google') || (isInitializing && activeMethod === 'google') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
            )}
            {isSigningIn && activeMethod === 'google'
              ? 'Signing in with Google...'
              : isInitializing
              ? 'Loading MASL workspace...'
              : t.signInWithGoogle}
          </button>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
            <p className="font-medium text-slate-700">Operational Focus</p>
            <p>
              Dedicated strictly to trolley lifecycle tracking, preventive maintenance compliance, breakdown turnaround, and plant safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
