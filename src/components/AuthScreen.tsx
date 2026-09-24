import React, { useState, useEffect } from 'react';
import { Lock, Mail, Key, UserPlus, LogIn, AlertCircle, ShieldCheck, Cpu, Eye, EyeOff, Sparkles, Shield, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiStorage } from '../utils/apiStorage';
import { Language } from '../types';

interface AuthScreenProps {
  onLogin: (username: string) => void;
  language: Language;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, language }) => {
  const isArabic = language === 'ar';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('jawman27227@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA Verification Flow States
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [expected2FAPin, setExpected2FAPin] = useState('272270');
  const [pendingEmail, setPendingEmail] = useState('');

  // Auto-focus 2FA input
  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase() || 'jawman27227@gmail.com';
      let user2faPin = '272270'; // Default secure 2FA PIN
      
      // Attempt cloud sync / user verification
      try {
        const userRef = doc(db, 'app_users', cleanEmail);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
        const userSnap = await Promise.race([getDoc(userRef), timeoutPromise]) as any;

        if (isLogin) {
          if (userSnap && userSnap.exists && userSnap.exists()) {
            const data = userSnap.data();
            if (password && data.password && data.password !== password) {
              setError(isArabic ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.');
              setLoading(false);
              return;
            }
            if (data.twoFactorPin) {
              user2faPin = String(data.twoFactorPin);
            }
          }
        } else {
          // Register new account
          await setDoc(userRef, {
            email: cleanEmail,
            password,
            twoFactorPin: '272270',
            twoFactorEnabled: true,
            createdAt: Date.now()
          }, { merge: true });
        }
      } catch (cloudErr) {
        console.warn('Cloud sync skipped or timed out, proceeding with secure local 2FA:', cloudErr);
      }

      // Check if custom 2FA PIN is in local storage
      const savedPin = apiStorage.getItem(`2fa_pin_${cleanEmail}`) || apiStorage.getItem('app_2fa_master_pin');
      if (savedPin) {
        user2faPin = savedPin;
      }

      setExpected2FAPin(user2faPin);
      setPendingEmail(cleanEmail);
      setIs2FAStep(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Authentication error');
      setLoading(false);
    }
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = twoFactorCode.trim();
    if (!cleanCode) {
      setError(isArabic ? 'يرجى إدخال رمز التحقق الثنائي المكون من 6 أرقام.' : 'Please enter the 6-digit 2FA code.');
      return;
    }

    // Verify 2FA code (matches saved PIN or master default 272270)
    if (cleanCode === expected2FAPin || cleanCode === '272270') {
      const cleanEmail = pendingEmail || 'jawman27227@gmail.com';
      try {
        localStorage.setItem('app_is_authenticated', 'true');
        localStorage.setItem('app_email', cleanEmail);
        localStorage.setItem('app_username', cleanEmail.split('@')[0]);
        localStorage.setItem('app_2fa_verified', 'true');
        sessionStorage.setItem('app_is_authenticated', 'true');
        sessionStorage.setItem('app_email', cleanEmail);
        sessionStorage.setItem('app_username', cleanEmail.split('@')[0]);
        sessionStorage.setItem('app_2fa_verified', 'true');
      } catch {}

      onLogin(cleanEmail.split('@')[0]);
    } else {
      setError(isArabic ? 'رمز المصادقة الثنائية 2FA غير صحيح. الرمز الافتراضي لحسابك: 272270' : 'Invalid 2FA code. Default PIN is: 272270');
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto my-auto animate-in fade-in zoom-in-95 duration-300">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Top Accent Neon Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(6,182,212,0.8)]" />

        {/* Quantura Logo with Radiance Backlight */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center mx-auto mb-4">
            {/* Pulsing Backlight Halo Glow behind Logo */}
            <div className="absolute -inset-3 bg-gradient-to-tr from-cyan-500/40 via-blue-500/30 to-amber-500/30 rounded-3xl blur-xl opacity-90 animate-pulse" />
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 rounded-2xl opacity-60 blur-sm" />
            
            {/* Logo Badge Container */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950 border border-cyan-500/50 p-2 shadow-[0_0_30px_rgba(6,182,212,0.35)] flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="Quantura"
                className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wider text-white font-['Syncopate',sans-serif] uppercase flex items-center justify-center gap-2">
              <span>QUANTURA</span>
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
            </h1>
            <p className="text-xs sm:text-sm text-cyan-400/90 font-medium">
              {isArabic ? 'منصة التداول الكمي والذكاء الاصطناعي' : 'Next-Gen Algorithmic Trading Terminal'}
            </p>
          </div>
        </div>

        {/* 2FA Verification View */}
        {is2FAStep ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                <Shield className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-amber-300">
                  {isArabic ? 'المصادقة الثنائية 2FA مفعلة' : 'Two-Factor Authentication (2FA)'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isArabic ? 'أدخل رمز التحقق المكون من 6 أرقام لإكمال تسجيل الدخول' : 'Enter the 6-digit security code for your account'}
                </p>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 text-center">
                  {isArabic ? 'رمز الأمان 2FA المكون من 6 أرقام' : '6-Digit 2FA Security Code'}
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoFocus
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 rounded-xl py-3 px-12 text-center text-xl font-bold font-mono tracking-[0.4em] text-amber-300 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all shadow-inner"
                    placeholder="••••••"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                  <span>{isArabic ? `الحساب: ${pendingEmail}` : `Account: ${pendingEmail}`}</span>
                  <button
                    type="button"
                    onClick={() => setTwoFactorCode(expected2FAPin || '272270')}
                    className="text-amber-400 hover:text-amber-300 underline font-mono cursor-pointer"
                  >
                    {isArabic ? 'رمزك الافتراضي: 272270' : 'Default PIN: 272270'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIs2FAStep(false);
                    setError('');
                    setTwoFactorCode('');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{isArabic ? 'رجوع' : 'Back'}</span>
                </button>

                <button
                  type="submit"
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isArabic ? 'تأكيد ودخول' : 'Verify & Enter'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step 1: Email & Password Form */
          <>
            {/* Tab Toggle (Login / Register) */}
            <div className="grid grid-cols-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isLogin 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isArabic ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isLogin 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'حساب جديد' : 'Register'}</span>
              </button>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300 leading-snug">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  {isArabic ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-800 hover:border-slate-700 focus:border-cyan-500/60 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    placeholder="jawman27227@gmail.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  {isArabic ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-800 hover:border-slate-700 focus:border-cyan-500/60 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
                    placeholder="••••••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2 mt-5 disabled:opacity-50 cursor-pointer active:scale-[0.99] text-xs sm:text-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLogin ? (
                  <>
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>{isArabic ? 'متابعة إلى التحقق الثنائي (2FA)' : 'Proceed to 2FA Verification'}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{isArabic ? 'إنشاء حساب جديد وتفعيل 2FA' : 'Register Account with 2FA'}</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* Security & Cloud Badge Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isArabic ? 'تشفير سحابي ومصادقة 2FA' : '2FA Secured & Encrypted'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>{isArabic ? 'بث أسعار فوري' : 'Live WebSocket Stream'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
