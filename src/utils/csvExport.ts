import { BacktestTrade, BacktestResult } from '../types';

export const exportBacktestToCSV = (result: BacktestResult) => {
  const headers = [
    'Trade ID',
    'Symbol',
    'Type',
    'Entry Time',
    'Exit Time',
    'Duration (Candles)',
    'Entry Price',
    'Exit Price',
    'Result',
    'PnL %',
    'PnL USDT',
    'Balance After',
    'R-Multiple',
    'Fee USDT',
    'Exit Reason'
  ];

  const rows = result.trades.map(t => [
    t.id,
    t.symbol,
    t.type,
    new Date(t.entryTime).toLocaleString(),
    new Date(t.exitTime).toLocaleString(),
    t.durationCandles || 0,
    t.entryPrice.toFixed(4),
    t.exitPrice.toFixed(4),
    t.result,
    t.pnlPercent.toFixed(2),
    t.pnlUsdt.toFixed(2),
    t.balanceAfter.toFixed(2),
    t.rMultiple.toFixed(2),
    t.feeUsdt?.toFixed(4) || 0,
    `"${t.exitReason || ''}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `backtest_${result.symbol}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
