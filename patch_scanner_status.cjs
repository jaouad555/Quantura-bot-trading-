const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

const oldCheck = `    // Stop scanning if globally disabled
    if (!config.enabled) {
      return;
    }`;

const newCheck = `    // Stop scanning if globally disabled
    if (!config.enabled) {
      if (scannerState.status === 'RUNNING') {
        scannerState.status = 'STOPPED';
        scannerState.symbolStates = {}; // Clear symbols
      }
      return;
    }
    
    if (scannerState.status === 'STOPPED') {
       scannerState.status = 'RUNNING';
    }`;

content = content.replace(oldCheck, newCheck);
fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Patched marketScanner.ts status");
