const fs = require('fs');
const file = 'src/server/botEngine.ts';
let code = fs.readFileSync(file, 'utf8');

// We want to comment out the inner logic of `startBotEngine` that mutates trades
// Instead of complex regex, let's just replace the whole `startBotEngine` with an empty one
// But we should keep the telegram sync! `startTelegramSync` is separate.
// Let's just redefine `startBotEngine` to only log or do nothing.
code = code.replace(/export const startBotEngine = \(\) => \{[\s\S]*?\n\};/, `export const startBotEngine = () => {
  console.log('🤖 Background Bot Engine is currently disabled to prevent conflicts with frontend engine.');
};`);

fs.writeFileSync(file, code);
