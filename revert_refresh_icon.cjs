const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Replace Radar with RefreshCw
content = content.replace(/<Radar className=/g, '<RefreshCw className=');

fs.writeFileSync('src/components/Header.tsx', content, 'utf8');
console.log('Restored RefreshCw icon');
