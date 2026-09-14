const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

// Remove DEFAULT_SYMBOLS entirely or just its usage
content = content.replace(/if \(enabledPairs\.length === 0\) \{\s+enabledPairs = DEFAULT_SYMBOLS;\s+\}/, '');

// Clean up symbolStates
const cleanupCode = `
    // Clean up state for symbols that are no longer enabled
    Object.keys(scannerState.symbolStates).forEach(sym => {
      if (!enabledPairs.includes(sym)) {
        delete scannerState.symbolStates[sym];
      }
    });

    const mode = await kv.get('app_execution_mode') || 'PAPER';`;

content = content.replace(/const mode = await kv\.get\('app_execution_mode'\) \|\| 'PAPER';/, cleanupCode);

fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner.ts");
