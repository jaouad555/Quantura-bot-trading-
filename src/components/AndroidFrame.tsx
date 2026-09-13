import React from 'react';
import { Wifi, Signal, Battery, Home, ChevronLeft, Square } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  isActive: boolean;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, isActive }) => {
  if (!isActive) {
    return <>{children}</>;
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="py-4 px-2 flex justify-center items-center min-h-screen bg-slate-950">
      {/* Smartphone Chassis */}
      <div className="w-full max-w-[420px] bg-slate-950 border-[10px] border-slate-800 rounded-[48px] shadow-2xl relative overflow-hidden ring-1 ring-slate-700/50 flex flex-col h-[850px] max-h-[92vh]">
        {/* Android Camera Notch & Speaker */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-36 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center gap-3">
          <div className="w-3 h-3 bg-slate-900 rounded-full border border-slate-800" />
          <div className="w-10 h-1 bg-slate-800 rounded-full" />
        </div>

        {/* Android Status Bar */}
        <div className="bg-slate-950 px-6 pt-2 pb-1 text-slate-300 text-xs font-mono flex items-center justify-between select-none z-40 shrink-0">
          <span className="font-bold text-[11px]">{timeString}</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-brand-400 font-bold">5G</span>
            <Wifi className="w-3 h-3 text-slate-200" />
            <Signal className="w-3 h-3 text-slate-200" />
            <div className="flex items-center gap-0.5">
              <span>98%</span>
              <Battery className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            </div>
          </div>
        </div>

        {/* App Content viewport */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
          {children}
        </div>

        {/* Android Bottom Navigation Bar */}
        <div className="bg-slate-950 border-t border-slate-900 py-2.5 px-12 flex items-center justify-between text-slate-500 z-40 shrink-0">
          <button className="hover:text-slate-200 transition">
            <Square className="w-4 h-4" />
          </button>
          <button className="hover:text-slate-200 transition">
            <Home className="w-4.5 h-4.5 text-slate-300" />
          </button>
          <button className="hover:text-slate-200 transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
