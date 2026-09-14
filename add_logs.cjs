const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

// Insert log generation
const insertLog = `
    const newLog = {
      id: \`log-pos-\${Date.now()}\`,
      timestamp: Date.now(),
      type: 'ENTRY',
      symbol: symbol,
      side: signal.decision === 'LONG' ? 'BUY' : 'SELL',
      price: currentPrice,
      amountUsdt: margin,
      pnlUsdt: 0,
      reason: \`Multi-Pair Scanner detected strong \${signal.decision} setup.\`,
      mode: isLive ? 'BINANCE_LIVE' : 'PAPER'
    };
    const logsStr = await kv.get('btc_bot_logs');
    const logs = logsStr ? JSON.parse(logsStr) : [];
    logs.unshift(newLog);
    await kv.set('btc_bot_logs', JSON.stringify(logs.slice(0, 500)));
    `;

content = content.replace(`positions.push(newPos);`, `${insertLog}\n    positions.push(newPos);`);
fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Added logs to marketScanner");
