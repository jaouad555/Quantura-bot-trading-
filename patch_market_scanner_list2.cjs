const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

// Insert import at the top
if (!content.includes("import { RESPECTED_TRADING_PAIRS }")) {
  content = content.replace("import { generateQuantitativePlan } from '../utils/quantEngine';", "import { generateQuantitativePlan } from '../utils/quantEngine';\nimport { RESPECTED_TRADING_PAIRS } from '../utils/tradingPairs';");
}

const replacement = `    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let allowedToExecute = rawAllowed.map(s => s.endsWith('USDT') ? s : s + 'USDT');
    
    // The scanner will ALWAYS monitor all respected pairs from the Header.
    let enabledPairs = RESPECTED_TRADING_PAIRS.map(p => p.symbol);`;

content = content.replace(/    let rawAllowed = config\.allowedSymbols \|\| \[\];[\s\S]*?let enabledPairs = \[\.\.\.new Set\(ALL_PAIRS\)\];/, replacement);

fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner.ts to use RESPECTED_TRADING_PAIRS");
