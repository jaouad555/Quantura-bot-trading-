const fs = require('fs');
let content = fs.readFileSync('src/server/botEngine.ts', 'utf8');

// 1. Remove wallet fetch at the top
content = content.replace(/      \/\/ Update Wallet\n      const walletStr = await kv\.get\('btc_paper_wallet'\);\n      let wallet = walletStr \? JSON\.parse\(walletStr\) : \{ balance: 1000, realizedPnl: 0 \};\n/g, '');

// 2. Accumulate deltas
const regexInit = /let stateChanged = false;\n      const logsToAdd: any\[\] = \[\];/;
content = content.replace(regexInit, `let stateChanged = false;
      let walletBalanceDelta = 0;
      let walletPnlDelta = 0;
      const logsToAdd: any[] = [];`);

// 3. Replace wallet mutations
content = content.replace(/wallet\.balance \+= Math\.max\(0, marginClosed \+ pnlUsdt\);/g, 'walletBalanceDelta += Math.max(0, marginClosed + pnlUsdt);');
content = content.replace(/wallet\.realizedPnl \+= pnlUsdt;/g, 'walletPnlDelta += pnlUsdt;');

// 4. Update save logic
const saveRegex = /await kv\.set\('btc_paper_wallet', JSON\.stringify\(wallet\)\);/;
const saveReplacement = `if (walletBalanceDelta !== 0 || walletPnlDelta !== 0) {
              const currentWalletStr = await kv.get('btc_paper_wallet');
              const currentWallet = currentWalletStr ? JSON.parse(currentWalletStr) : { balance: 1000, realizedPnl: 0 };
              currentWallet.balance += walletBalanceDelta;
              currentWallet.realizedPnl += walletPnlDelta;
              await kv.set('btc_paper_wallet', JSON.stringify(currentWallet));
          }`;
content = content.replace(saveRegex, saveReplacement);

// 5. Check if we broke telegram logic. Telegram logic uses `wallet`.
// It runs independently every hour.
// Telegram interval is separate.
// Wait, is `wallet` used anywhere else in engineInterval? Let's check.

fs.writeFileSync('src/server/botEngine.ts', content, 'utf8');
console.log("Patched botEngine.ts wallet race condition");
