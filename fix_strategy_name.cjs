const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const regex = /strategyName: signal\.strategyName \|\| 'Quantitative AI',/;
const replacement = `strategyName: (function() {
        let name = signal.strategyName || 'Quantitative AI';
        if (config.activePresets && config.activePresets.length > 0) {
          const presetKey = config.activePresets[Date.now() % config.activePresets.length];
          switch(presetKey) {
            case 'MOMENTUM': name = 'Momentum Grid'; break;
            case 'SCALPER': name = 'HFT Scalper'; break;
            case 'SWING': name = 'Swing Trend'; break;
            case 'BREAKOUT': name = 'Volatility Breakout'; break;
            case 'MEAN_REVERSION': name = 'Mean Reversion'; break;
            case 'INSTITUTIONAL_SMC': name = 'Institutional SMC'; break;
            default: name = presetKey;
          }
        }
        return name;
      })(),`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner strategyName");
