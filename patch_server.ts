import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const importStatement = `\nimport { startMarketScanner, scannerState } from './src/server/marketScanner';`;
content = content.replace(`import { startBotEngine, startTelegramSync } from './src/server/botEngine';`, `import { startBotEngine, startTelegramSync } from './src/server/botEngine';${importStatement}`);

const scannerEndpoint = `
app.get('/api/scanner/status', (req, res) => {
  res.json(scannerState);
});
`;
content = content.replace(`// API ROUTE 1: GET /api/binance/market-data`, `${scannerEndpoint}\n// API ROUTE 1: GET /api/binance/market-data`);

content = content.replace(`startBotEngine();\n    startTelegramSync();`, `startBotEngine();\n    startTelegramSync();\n    startMarketScanner();`);

fs.writeFileSync('server.ts', content, 'utf8');
