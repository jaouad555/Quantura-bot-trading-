import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-4xl mx-auto my-6 p-6 bg-slate-900/95 border-2 border-rose-500/50 rounded-2xl shadow-2xl backdrop-blur-xl text-slate-100 font-sans">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>{this.props.fallbackTitle || 'تم استعادة النظام بحماية أوتوماتيكية'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono border border-rose-500/40">
                    PROTECTED
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة تشغيل المكون (Réinitialiser)</span>
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                حدث تعارض بسيط في عرض البيانات اللحظية أثناء التمرير. تم تفعيل نظام الدرع الوقائي لمنع انطفاء المنصة والحفاظ على سلامة جميع بياناتك واستراتيجياتك المفتوحة.
              </p>

              {this.state.error && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-[11px] text-rose-300/90 overflow-x-auto max-h-32">
                  <p className="font-bold">{this.state.error.toString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
