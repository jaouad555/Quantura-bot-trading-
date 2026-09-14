const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const replacement = `
    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let allowedToExecute = rawAllowed.map(s => s.endsWith('USDT') ? s : s + 'USDT');
    
    // The scanner will ALWAYS monitor all respected pairs from the Header.
    // The execution will only happen if it's in allowedToExecute.
    const ALL_PAIRS = [
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", 
        "DOTUSDT", "MATICUSDT", "LINKUSDT", "DOGEUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", 
        "TRXUSDT", "ETCUSDT", "BCHUSDT", "XLMUSDT", "ALGOUSDT", "VETUSDT", "PEPEUSDT", 
        "SHIBUSDT", "APTUSDT", "INJUSDT", "RENDERUSDT", "AAVEUSDT", "WIFUSDT", "FETUSDT"
    ];
    // Remove duplicates just in case
    let enabledPairs = [...new Set(ALL_PAIRS)];
`;

content = content.replace(/let rawAllowed = config\.allowedSymbols \|\| \[\];[\s\S]*?let enabledPairs = rawAllowed\.map\(.*?USDT'\);/, replacement);

// Pass allowedToExecute to analyzeSymbol
content = content.replace(/await analyzeSymbol\(symbol, config, isLive, marketType\);/g, `await analyzeSymbol(symbol, config, isLive, marketType, allowedToExecute);`);
content = content.replace(/async function analyzeSymbol\(symbol: string, config: any, isLive: boolean, marketType: string\)/, `async function analyzeSymbol(symbol: string, config: any, isLive: boolean, marketType: string, allowedToExecute: string[])`);

// Check allowedToExecute before processing trade
const execCheck = `    // 3. Execution Logic
    const isAllowedToTrade = allowedToExecute.includes(normSymbol);
    if (signal.confidence >= (config.minConfidence || 75) && (signal.decision === 'LONG' || signal.decision === 'SHORT')) {
      if (isAllowedToTrade) {
        await processTradingSignal(normSymbol, signal, data.ticker.price, config, isLive);
      }
    }`;
content = content.replace(/    \/\/ 3\. Execution Logic\s*if \(signal\.confidence >= \(config\.minConfidence \|\| 75\) && \(signal\.decision === 'LONG' \|\| signal\.decision === 'SHORT'\)\) \{\s*await processTradingSignal\(normSymbol, signal, data\.ticker\.price, config, isLive\);\s*\}/, execCheck);

fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner.ts list");
