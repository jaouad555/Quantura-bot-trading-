const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const importComponent = `import { MarketScannerStatus } from './components/MarketScannerStatus';`;
content = content.replace(`import { Header } from './components/Header';`, `import { Header } from './components/Header';\n${importComponent}`);

const tabStart = `{/* Tab: Automated AI Trading Bot (Auto Buy, TP1 Exit 50%, Rebuy, TP2 Exit) */}
          {activeTab === 'autoBot' && (
            <>
              <MarketScannerStatus />
              <AutoTradingBot`;

content = content.replace(`{/* Tab: Automated AI Trading Bot (Auto Buy, TP1 Exit 50%, Rebuy, TP2 Exit) */}
          {activeTab === 'autoBot' && (
            <AutoTradingBot`, tabStart);

content = content.replace(/<\/AutoTradingBot>\n          \)}/, `</AutoTradingBot>\n            </>\n          )}`);

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log("Patched App.tsx for ScannerStatus");
