const fs = require('fs');
let content = fs.readFileSync('src/components/TradingChart.tsx', 'utf8');

// The main wrapper of TradingChart currently is:
// <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl">
// We can make it flex and grow
content = content.replace(
  'className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl"',
  'className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col h-full min-h-[450px]"'
);

// The chart canvas wrapper:
// <div className="relative w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/90">
content = content.replace(
  'className="relative w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/90"',
  'className="relative w-full flex-1 overflow-hidden rounded-xl bg-slate-950 border border-slate-800/90"'
);

// The actual chart div:
// <div ref={chartContainerRef} className="w-full h-[400px]" />
content = content.replace(
  'className="w-full h-[400px]"',
  'className="w-full h-full min-h-[350px]"'
);

fs.writeFileSync('src/components/TradingChart.tsx', content);
