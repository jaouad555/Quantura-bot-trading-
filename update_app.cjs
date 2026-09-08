const fs = require('fs');
const p = 'src/App.tsx';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  "        const amountCrypto = positionSizeUsdt / entryPrice;",
  "        const amountCrypto = positionSizeUsdt / entryPrice;\n\n        let strategyName = 'Custom';\n        if (currentConfig.activePresets && currentConfig.activePresets.length > 0) {\n          strategyName = currentConfig.activePresets.map(s => s.charAt(0) + s.slice(1).toLowerCase()).join(' + ');\n        } else if (currentConfig.timeframe === 'AUTO') {\n          strategyName = 'Multi-Strategy';\n        }"
);

code = code.replace(
  "          rebuysCount: 0,\n          openedAt: Date.now(),\n          lastAction: isArabicLang",
  "          rebuysCount: 0,\n          openedAt: Date.now(),\n          strategyName,\n          lastAction: isArabicLang"
);

// We need to update where closedHistoryItem is created to include strategyName as well.
// There are multiple places.
code = code.replace(/confidence: (75|80),\n\s*pnlHistory/g, "confidence: $1,\n          strategyName: pos.strategyName,\n          pnlHistory");
code = code.replace(/confidence: (75|80),\n\s*reason:(.*),\n\s*pnlHistory/g, "confidence: $1,\n          reason: $2,\n          strategyName: existingPos.strategyName || pos.strategyName,\n          pnlHistory");

fs.writeFileSync(p, code);
