const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

// Remove the strict RUNNING check at the top
content = content.replace(/if \(scannerState\.status !== 'RUNNING'\) return;\s+try \{/, 'try {');

fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
console.log("Fixed status check in marketScanner.ts");
