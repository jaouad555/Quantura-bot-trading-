const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const regex = /let enabledPairs = config.allowedSymbols \|\| \[\];/;
const replacement = `
    let rawAllowed = config.allowedSymbols || [];
    // Convert base symbols like "BTC" to "BTCUSDT"
    let enabledPairs = rawAllowed.map(s => s.endsWith('USDT') ? s : s + 'USDT');
`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner.ts symbols");
