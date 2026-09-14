const fs = require('fs');
let content = fs.readFileSync('src/components/MarketScannerStatus.tsx', 'utf8');

const replacement = `No pairs currently monitored. Enable Auto-Trading to start scanner.`;
content = content.replace(/No pairs currently monitored\. Please enable Auto-Trading and select coins to start scanner\./, replacement);

fs.writeFileSync('src/components/MarketScannerStatus.tsx', content, 'utf8');
