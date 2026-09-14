const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startBlock = `    // 1. Check New Position Entry`;
const endBlock = `    // 2. Trailing Stop Loss Updates`;

const startIndex = content.indexOf(startBlock);
const endIndex = content.indexOf(endBlock);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + `    // 1. Check New Position Entry - MOVED TO SERVER\n` + content.substring(endIndex);
  fs.writeFileSync('src/App.tsx', content, 'utf8');
  console.log("Patched auto trade entry");
} else {
  console.log("Not found");
}
