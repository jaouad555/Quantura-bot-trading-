const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const oldConcurrency = `    // Concurrency control: analyze pairs independently
    await Promise.allSettled(
      enabledPairs.map(symbol => analyzeSymbol(symbol, config, isLive, marketType))
    );`;

const newConcurrency = `    // Concurrency control: scan sequentially with slight delay to respect Binance API limits
    for (const symbol of enabledPairs) {
      if (scannerState.status !== 'RUNNING') break;
      await analyzeSymbol(symbol, config, isLive, marketType);
      await new Promise(r => setTimeout(r, 2000)); // 2s stagger
    }`;

content = content.replace(oldConcurrency, newConcurrency);
fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched concurrency");
