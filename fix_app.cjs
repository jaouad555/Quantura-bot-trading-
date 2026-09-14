const fs = require('fs');

// Fix MarketScannerStatus.tsx
let m = fs.readFileSync('src/components/MarketScannerStatus.tsx', 'utf8');
m = m.replace(/\\\$\\\{state\.confidence\\\}/g, '${state.confidence}');
fs.writeFileSync('src/components/MarketScannerStatus.tsx', m, 'utf8');

// Fix App.tsx
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The replacement was botched: `                    </><`
content = content.replace(/                    <\/></g, '            </>\n          )}');

fs.writeFileSync('src/App.tsx', content, 'utf8');
