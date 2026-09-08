const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Add Radar to imports
if (!content.includes('Radar,')) {
    content = content.replace('import {', 'import {\n  Radar,');
}

// Extract refresh button
const refreshButtonRegex = /\{\/\* 4\. Refresh Button \*\/\}\s*<button\s*onClick=\{onRefreshData\}[\s\S]*?<\/button>/;
const refreshMatch = content.match(refreshButtonRegex);

if (refreshMatch) {
    let refreshButtonCode = refreshMatch[0];
    
    // Change RefreshCw to Radar
    refreshButtonCode = refreshButtonCode.replace(/<RefreshCw/g, '<Radar');
    
    // Remove it from the current position
    content = content.replace(refreshMatch[0], '');
    
    // Insert it next to the price.
    // The price block is inside: <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl px-2.5 sm:px-3 py-1.5 shrink-0 shadow-inner">
    const priceBlockEndRegex = /<div className="hidden md:inline-block">\s*\{getConnectionBadge\(\)\}\s*<\/div>\s*<\/div>/;
    
    const replacement = `
                {/* 4. Refresh Button (Moved next to price) */}
                <button
                  onClick={onRefreshData}
                  disabled={isRefreshing}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 transition disabled:opacity-50 shrink-0 ml-1"
                  title={isArabic ? 'تحديث البيانات' : 'Actualiser'}
                >
                  <Radar className={\`w-3.5 h-3.5 \${isRefreshing ? 'animate-spin text-emerald-400' : ''}\`} />
                </button>
                <div className="hidden md:inline-block">
                  {getConnectionBadge()}
                </div>
              </div>`;
              
    content = content.replace(priceBlockEndRegex, replacement);
    
    fs.writeFileSync('src/components/Header.tsx', content, 'utf8');
    console.log('Fixed refresh button');
} else {
    console.log('Could not find refresh button block');
}
