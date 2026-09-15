const fs = require('fs');
let code = fs.readFileSync('src/components/AuthScreen.tsx', 'utf8');

code = `import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Lock, Mail, Key, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Language } from '../types';

interface AuthScreenProps {
  onLogin: (username: string) => void;
  language: Language;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, language }) => {
  const isArabic = language === 'ar';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onLogin(email.split('@')[0]);
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError(isArabic 
          ? 'عذراً! يجب تفعيل "Email/Password" من إعدادات Authentication في Firebase Console أولاً.' 
          : 'Email/Password sign-in is disabled. Please enable it in the Firebase Console under Authentication -> Sign-in method.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError(isArabic ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : 'Email is already registered. Please log in.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(isArabic ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
      
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Lock className="w-8 h-8 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {isArabic ? 'بوابة الدخول' : 'Quantura Gateway'}
        </h1>
        <p className="text-slate-400 text-sm">
          {isArabic 
            ? 'تطبيق التداول الآلي محمي. يرجى تسجيل الدخول للوصول إلى محفظتك وإعداداتك السحابية.' 
            : 'Automated trading system is secured. Please sign in to access your cloud portfolio.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
            {isArabic ? 'البريد الإلكتروني' : 'Email Address'}
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              placeholder="trading@example.com"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
            {isArabic ? 'كلمة المرور' : 'Password'}
          </label>
          <div className="relative">
            <Key className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(8,145,178,0.3)] hover:shadow-[0_0_20px_rgba(8,145,178,0.5)] flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isLogin ? (
            <>
              <LogIn className="w-5 h-5" />
              <span>{isArabic ? 'دخول آمن' : 'Secure Login'}</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>{isArabic ? 'إنشاء حساب جديد (تسجيل)' : 'Create Account'}</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          type="button"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {isLogin 
            ? (isArabic ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'Need an account? Sign up') 
            : (isArabic ? 'لديك حساب مسجل بالفعل؟ تسجيل الدخول' : 'Have an account? Log in')}
        </button>
      </div>
    </div>
  );
};
`;

fs.writeFileSync('src/components/AuthScreen.tsx', code);
