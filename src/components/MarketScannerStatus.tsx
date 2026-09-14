import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock, Server } from 'lucide-react';

export const MarketScannerStatus: React.FC = () => {
  const [statusData, setStatusData] = useState<any>(null);

  useEffect(() => {
    let isActive = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/scanner/status');
        if (res.ok && isActive) {
          const data = await res.json();
          setStatusData(data);
        }
      } catch (err) {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  if (!statusData) {
    return null;
  }

  const { status, lastGlobalScan, symbolStates } = statusData;

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Server className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">Global Market Scanner</h2>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400">Engine:</span>
            {status === 'RUNNING' ? (
              <span className="flex items-center text-xs font-medium text-emerald-400">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                RUNNING
              </span>
            ) : (
              <span className="flex items-center text-xs font-medium text-red-400">
                <XCircle className="w-3 h-3 mr-1" />
                STOPPED
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">
              {lastGlobalScan ? new Date(lastGlobalScan).toLocaleTimeString() : '--:--:--'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {Object.values(symbolStates || {}).map((state: any) => (
          <div key={state.symbol} className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-2 flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-slate-200">{state.symbol}</span>
              {Date.now() - state.lastAnalyzed < 15000 ? (
                <Activity className="w-3 h-3 text-emerald-400" />
              ) : (
                <CheckCircle className="w-3 h-3 text-slate-500" />
              )}
            </div>
            
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Signal:</span>
              <span className={
                state.lastSignal === 'LONG' ? 'text-emerald-400 font-bold' : 
                state.lastSignal === 'SHORT' ? 'text-red-400 font-bold' : 
                'text-slate-400'
              }>
                {state.lastSignal || 'NONE'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Confidence:</span>
              <span className="text-slate-300">{state.confidence ? `${state.confidence}%` : '-'}</span>
            </div>
            
            <div className="text-[9px] text-slate-500 mt-1 text-right">
              {state.lastAnalyzed ? new Date(state.lastAnalyzed).toLocaleTimeString() : 'Pending'}
            </div>
          </div>
        ))}
        {Object.keys(symbolStates || {}).length === 0 && (
          <div className="col-span-full text-center text-xs text-slate-500 py-2">
            No pairs currently monitored. Enable Auto-Trading to start scanner.
          </div>
        )}
      </div>
    </div>
  );
};
