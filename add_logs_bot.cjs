const fs = require('fs');
let content = fs.readFileSync('src/server/botEngine.ts', 'utf8');

const insertLog = `
              const logType = isTp3 ? 'TP3_HIT' : 'SL_HIT';
              logsToAdd.push({
                id: \`log-server-\${Date.now()}\`,
                timestamp: Date.now(),
                type: logType,
                symbol: pos.symbol,
                side: pos.decision === 'LONG' ? 'SELL' : 'BUY',
                price: currentP,
                amountUsdt: marginClosed,
                pnlUsdt: finalPnlUsdt,
                reason: \`Server Executed \${logType}\`,
                mode: isLiveMode ? 'BINANCE_LIVE' : 'PAPER'
              });
`;

content = content.replace(`historyToAdd.push({`, `${insertLog}\n            historyToAdd.push({`);

const saveLogs = `
          if (logsToAdd.length > 0) {
              const logsStr = await kv.get('btc_bot_logs');
              const logs = logsStr ? JSON.parse(logsStr) : [];
              await kv.set('btc_bot_logs', JSON.stringify([...logsToAdd, ...logs].slice(0, 500)));
          }
`;

content = content.replace(`if (historyToAdd.length > 0) {`, `${saveLogs}\n          if (historyToAdd.length > 0) {`);
fs.writeFileSync('src/server/botEngine.ts', content, 'utf8');
console.log("Added logs to botEngine");
