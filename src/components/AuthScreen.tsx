import { apiStorage } from "../utils/apiStorage";
import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, Mail, Terminal, ArrowRight, Activity, ShieldCheck, User, Zap, ScanFace, KeyRound, QrCode, Copy, CheckCircle2, ChevronDown, Smartphone, AlertCircle, RefreshCw, Eye, EyeOff, RotateCcw, ShieldOff } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { getOrCreate2FASecret, generateNew2FASecret, formatSecretKeyWithSpaces, getCurrentTOTP, getTOTPUri, generateQRCodeDataUrl, verifyTOTP, getTOTPTimeRemaining, is2FAConfigured, set2FAConfigured, is2FAEnabled, set2FAEnabled, disable2FA } from '../utils/totp';

interface AuthScreenProps {
  onLogin: (username: string) => void;
  language: Language;
}

type AuthStep = 'credentials' | '2fa';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, language }) => {
  const [step, setStep] = useState<AuthStep>('credentials');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [enable2FAOption, setEnable2FAOption] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [activeTab2FA, setActiveTab2FA] = useState<'qr' | 'manual'>('manual');
  const [showLiveCode, setShowLiveCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(getTOTPTimeRemaining());
  const [currentLiveTOTP, setCurrentLiveTOTP] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const t = translations[language];

  // Initialize or fetch real 2FA secret and check configuration status
  useEffect(() => {
    if (step === '2fa') {
      const userIdent = email ? email.split('@')[0] : 'JAOUAD';
      const secret = getOrCreate2FASecret(userIdent);
      setSecretKey(secret);
      setCurrentLiveTOTP(getCurrentTOTP(secret));
      
      const alreadyConfigured = is2FAConfigured(userIdent);
      setIsConfigured(alreadyConfigured);

      // Only generate QR code if NOT configured (first time setup)
      if (!alreadyConfigured) {
        const uri = getTOTPUri(secret, `Quantura (${email || 'JAOUAD'})`);
        generateQRCodeDataUrl(uri).then(setQrCodeDataUrl).catch(console.error);
      }
    }
  }, [step, email]);

  // Live countdown and current token update for the 30-second TOTP window
  useEffect(() => {
    if (step !== '2fa' || !secretKey) return;
    const interval = setInterval(() => {
      const remaining = getTOTPTimeRemaining();
      setTimeRemaining(remaining);
      if (remaining === 30 || remaining === 29) {
        setCurrentLiveTOTP(getCurrentTOTP(secretKey));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [step, secretKey]);

  const handleRegenerateSecret = () => {
    const userIdent = email ? email.split('@')[0] : 'JAOUAD';
    const newSecret = generateNew2FASecret(userIdent);
    set2FAConfigured(false, userIdent);
    setIsConfigured(false);
    setSecretKey(newSecret);
    setCurrentLiveTOTP(getCurrentTOTP(newSecret));
    const uri = getTOTPUri(newSecret, `Quantura (${email || 'JAOUAD'})`);
    generateQRCodeDataUrl(uri).then(setQrCodeDataUrl).catch(console.error);
    setError('');
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : language === 'en' ? 'Please fill in all required fields' : 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setError('');
    setIsAuthenticating(true);

    // Simulate backend password validation
    setTimeout(() => {
      try {
        const storedUsersRaw = apiStorage.getItem('quantura_mock_users');
        const storedUsers = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};

        if (isLogin) {
          if (!storedUsers[email]) {
            setIsAuthenticating(false);
            setError(
              language === 'ar' ? 'الحساب غير موجود، يرجى التسجيل أولاً' : 
              language === 'en' ? 'Account not found, please sign up first' : 
              'Compte introuvable, veuillez vous inscrire'
            );
            return;
          }
          if (storedUsers[email].password !== password) {
            setIsAuthenticating(false);
            setError(
              language === 'ar' ? '❌ كلمة المرور غير صحيحة!' : 
              language === 'en' ? '❌ Incorrect password!' : 
              '❌ Mot de passe incorrect !'
            );
            return;
          }
        } else {
          if (storedUsers[email]) {
            setIsAuthenticating(false);
            setError(
              language === 'ar' ? 'البريد الإلكتروني مسجل بالفعل' : 
              language === 'en' ? 'Email is already registered' : 
              'Cet e-mail est déjà utilisé'
            );
            return;
          }
          storedUsers[email] = { name, password };
          apiStorage.setItem('quantura_mock_users', JSON.stringify(storedUsers));
        }
      } catch (err) {
        console.error('Error validating credentials', err);
      }

      setIsAuthenticating(false);
      const userIdent = email ? email.split('@')[0] : 'JAOUAD';

      // If user explicitly checked the enable 2FA box, enable it; otherwise respect existing status
      if (enable2FAOption) {
        set2FAEnabled(true, userIdent);
      }

      const isEnabled = is2FAEnabled(userIdent);
      
      // If 2FA is NOT enabled, log them in directly! (2FA is strictly optional)
      if (!isEnabled) {
        const username = isLogin ? (email ? email.split('@')[0].toUpperCase() : 'JAOUAD') : name.toUpperCase();
        onLogin(username);
        return;
      }
      
      const secret = getOrCreate2FASecret(userIdent);
      setSecretKey(secret);
      setCurrentLiveTOTP(getCurrentTOTP(secret));
      setIsConfigured(true);
      setStep('2fa');
      setTwoFactorCode('');
    }, 600);
  };

  const handleCopySecret = () => {
    if (!secretKey) return;
    navigator.clipboard.writeText(secretKey);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = twoFactorCode.trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setError(
        language === 'ar'
          ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام'
          : language === 'en'
          ? 'Please enter the 6-digit verification code'
          : 'Veuillez entrer le code de vérification à 6 chiffres'
      );
      return;
    }

    setError('');
    setIsAuthenticating(true);

    // Strict RFC 6238 TOTP verification with user's secret key
    setTimeout(() => {
      const isValid = verifyTOTP(cleanCode, secretKey);
      if (!isValid) {
        setIsAuthenticating(false);
        setError(
          language === 'ar'
            ? '❌ رمز التحقق غير مطابق! تم رفض الرمز العشوائي. يرجى إدخال الرمز الصحيح المولد حالياً في تطبيق Google Authenticator أو Authy.'
            : language === 'en'
            ? '❌ Invalid verification code! Random numbers are rejected. Please enter the current valid 6-digit code from your Authenticator app.'
            : '❌ Code invalide ! Les codes aléatoires sont rejetés. Veuillez saisir le code à 6 chiffres valide de votre application Authenticator.'
        );
        return;
      }

      // Mark 2FA as configured and active
      const userIdent = email ? email.split('@')[0] : 'JAOUAD';
      set2FAEnabled(true, userIdent);
      setIsConfigured(true);

      setIsAuthenticating(false);
      const username = isLogin ? (email ? email.split('@')[0].toUpperCase() : 'JAOUAD') : name.toUpperCase();
      onLogin(username);
    }, 400);
  };

  const handleBypassOrDisable2FA = () => {
    const userIdent = email ? email.split('@')[0] : 'JAOUAD';
    disable2FA(userIdent);
    const username = isLogin ? (email ? email.split('@')[0].toUpperCase() : 'JAOUAD') : (name ? name.toUpperCase() : 'JAOUAD');
    onLogin(username);
  };

  const getLabel = (ar: string, en: string, fr: string) => {
    return language === 'ar' ? ar : language === 'en' ? en : fr;
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px] mix-blend-screen opacity-50 animate-pulse"></div>
        <div className="absolute top-[60%] -right-[10%] w-[35%] h-[35%] rounded-full bg-emerald-900/10 blur-[120px] mix-blend-screen opacity-50"></div>
        
        {/* Subtle Grid lines */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA0MCAwIEwgMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgzMCwgNDEsIDU5LCAwLjE1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-60"></div>
      </div>

      <div className="w-full max-w-md z-10 relative">
        {/* Logo and Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-slate-900/90 border border-slate-800 shadow-[0_0_35px_rgba(34,211,238,0.2)] rounded-3xl mb-4 relative group">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-3xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img src="/logo.png" alt="Quantura Logo" className="w-24 h-24 relative z-10 object-contain drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-['Syncopate',sans-serif] font-bold text-white tracking-widest uppercase mb-2 text-sweep-shine">
            Quantura
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-[0.2em] uppercase">
            {getLabel('المحطة الخوارزمية للتداول', 'Algorithmic Trading Terminal', 'Terminal de Trading Algorithmique')}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          {/* Top Edge Glow */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
          
          {step === 'credentials' ? (
            <>
              <div className="flex bg-slate-950/80 rounded-xl p-1 mb-8 border border-slate-800/50">
                <button
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-lg transition-all duration-300 ${isLogin ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 shadow-[0_0_15px_rgba(8,145,178,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {getLabel('تسجيل الدخول', 'LOGIN', 'CONNEXION')}
                </button>
                <button
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`flex-1 py-2.5 text-xs font-bold tracking-wider rounded-lg transition-all duration-300 ${!isLogin ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 shadow-[0_0_15px_rgba(8,145,178,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {getLabel('حساب جديد', 'REGISTER', 'S\'INSCRIRE')}
                </button>
              </div>

              <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                {!isLogin && (
                  <div className="space-y-1.5 relative group">
                    <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase ml-1">
                      {getLabel('الاسم الكامل', 'Full Name', 'Nom Complet')}
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 font-medium"
                        placeholder="John Doe"
                        disabled={isAuthenticating}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase ml-1">
                    {getLabel('البريد الإلكتروني', 'Email Address', 'Adresse Email')}
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 font-medium"
                      placeholder="agent@quantura.net"
                      disabled={isAuthenticating}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative group">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                      {getLabel('كلمة المرور', 'Password', 'Mot de passe')}
                    </label>
                    {isLogin && (
                      <button type="button" className="text-[10px] text-cyan-500 hover:text-cyan-400 hover:underline transition-all">
                        {getLabel('نسيت كلمة المرور؟', 'Forgot Password?', 'Mot de passe oublié?')}
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600 font-medium tracking-widest"
                      placeholder="••••••••"
                      disabled={isAuthenticating}
                    />
                  </div>
                </div>

                {/* Optional 2FA Activation Checkbox */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {getLabel('تفعيل المصادقة الثنائية 2FA (اختياري)', 'Enable 2FA (Optional)', 'Activer 2FA (Optionnel)')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {getLabel('حماية إضافية لحسابك عبر Google Authenticator', 'Extra security via Authenticator app', 'Protection renforcée via Authenticator')}
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={enable2FAOption} 
                      onChange={(e) => setEnable2FAOption(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl py-3.5 font-bold text-sm tracking-widest uppercase transition-all duration-300 hover:from-cyan-500 hover:to-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] mt-6"
                >
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA0MCAwIEwgMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>
                  
                  <div className="relative flex items-center justify-center gap-2 z-10">
                    {isAuthenticating ? (
                      <>
                        <Zap className="w-4 h-4 animate-pulse text-cyan-200" />
                        <span>{getLabel('جاري التحقق...', 'VERIFYING...', 'VÉRIFICATION...')}</span>
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4 text-cyan-100" />
                        <span>{getLabel('متابعة', 'CONTINUE', 'CONTINUER')}</span>
                        <ArrowRight className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''} transition-transform group-hover:translate-x-1`} />
                      </>
                    )}
                  </div>
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-cyan-500/10 rounded-2xl mb-2 border border-cyan-500/20 relative">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
                </div>
                <h3 className="text-base font-bold text-white mb-0.5">
                  {getLabel('المصادقة الثنائية (Google Authenticator)', 'Two-Factor Authentication (2FA)', 'Authentification à Deux Facteurs (2FA)')}
                </h3>
                <p className="text-xs text-slate-400 px-2 leading-relaxed">
                  {isConfigured
                    ? getLabel(
                        'أدخل الرمز المتجدد المكون من 6 أرقام من تطبيق Google Authenticator على هاتفك:',
                        'Enter the 6-digit dynamic code from Google Authenticator on your phone:',
                        'Entrez le code dynamique à 6 chiffres depuis votre application Google Authenticator :'
                      )
                    : getLabel(
                        'إعداد لأول مرة: انسخ المفتاح السري أدناه أو امسح الرمز لتسجيل الحساب في هاتفك:',
                        'First-time setup: Copy the secret key below or scan QR code into your Authenticator app:',
                        'Configuration initiale : Copiez la clé secrète ci-dessous ou scannez le QR code :'
                      )}
                </p>
              </div>

              {/* Returning user mode: Key is securely saved in Authenticator app and permanently hidden from screen */}
                            <div className="bg-emerald-950/25 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3 animate-in fade-in duration-200">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-300">
                    {getLabel('المفتاح السري محفوظ ومحمي بأمان', 'Secret Key Securely Protected', 'Clé secrète protégée')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {getLabel('تم إخفاء المفتاح نهائياً لأسباب أمنية. افتح تطبيق الهاتف وأدخل الرمز أدناه.', 'Key is permanently hidden for security. Open Authenticator and enter code below.', 'Clé masquée pour des raisons de sécurité. Entrez le code ci-dessous.')}
                  </div>
                </div>
              </div>

              {/* 6-Digit Code Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    {getLabel('أدخل الرمز المكون من 6 أرقام:', 'Enter the 6-digit verification code:', 'Entrez le code à 6 chiffres :')}
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {twoFactorCode.length}/6 {getLabel('أرقام', 'digits', 'chiffres')}
                  </span>
                </div>

                <div className="relative flex items-center justify-center group">
                  <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors z-10" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => {
                      setTwoFactorCode(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl py-3 pl-10 pr-4 text-center text-2xl tracking-[0.5em] text-cyan-300 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40 transition-all font-mono placeholder:text-slate-700 placeholder:tracking-[0.4em]"
                    placeholder="••••••"
                    disabled={isAuthenticating}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs py-2.5 px-3 rounded-xl flex items-start gap-2 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setTwoFactorCode(''); setError(''); }}
                  disabled={isAuthenticating}
                  className="px-4 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all text-xs font-bold tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {getLabel('رجوع', 'BACK', 'RETOUR')}
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating || twoFactorCode.length < 6}
                  className="flex-1 relative group overflow-hidden bg-gradient-to-r from-cyan-600 to-emerald-600 text-white rounded-xl py-3 font-bold text-xs tracking-widest uppercase transition-all duration-300 hover:from-cyan-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] cursor-pointer"
                >
                  <div className="relative flex items-center justify-center gap-2 z-10">
                    {isAuthenticating ? (
                      <>
                        <Zap className="w-4 h-4 animate-pulse text-cyan-200" />
                        <span>{getLabel('جاري التحقق من الرمز...', 'VERIFYING CODE...', 'VÉRIFICATION DU CODE...')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-cyan-100" />
                        <span>{getLabel('تأكيد الدخول', 'VERIFY & ENTER', 'CONFIRMER LA CONNEXION')}</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Optional 2FA Quick Bypass & Disable */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {getLabel('2FA ميزة اختيارية:', '2FA is optional:', '2FA est optionnel :')}
                </span>
                <button
                  type="button"
                  onClick={handleBypassOrDisable2FA}
                  disabled={isAuthenticating}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 hover:underline cursor-pointer transition"
                  title={getLabel('تسجيل الدخول وتعطيل 2FA', 'Sign In and Disable 2FA', 'Se connecter et désactiver 2FA')}
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                  <span>{getLabel('الدخول المباشر وتعطيل 2FA', 'Sign in & Disable 2FA', 'Connexion directe sans 2FA')}</span>
                </button>
              </div>
            </form>
          )}

          {/* Secure Badge */}
          <div className="mt-8 flex items-center justify-center gap-1.5 opacity-60">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[9px] font-mono tracking-widest text-amber-400/80 uppercase">
              {getLabel('اتصال مشفر 256-BIT', '256-BIT SECURE CONNECTION', 'CONNEXION SÉCURISÉE 256-BIT')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
