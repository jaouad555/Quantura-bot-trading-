const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const replacement = `
    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let allowedToExecute = rawAllowed.map(s => s.endsWith('USDT') ? s : s + 'USDT');
    
    // The scanner will ALWAYS monitor all respected pairs from the Header.
    // The execution will only happen if it's in allowedToExecute.
    const { RESPECTED_TRADING_PAIRS } = require('../utils/tradingPairs');
    let enabledPairs = RESPECTED_TRADING_PAIRS.map(p => p.symbol);
`;

// It's typescript, so we can't use require inside the function cleanly like this.
// Let's just import it at the top.
