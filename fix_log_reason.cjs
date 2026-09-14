const fs = require('fs');
let content = fs.readFileSync('src/server/marketScanner.ts', 'utf8');

content = content.replace(
  /reason: \`Multi-Pair Scanner detected strong \$\{signal\.decision\} setup\.\`,/,
  "reason: `[${newPos.strategyName}] Scanner detected strong ${signal.decision} setup.`,"
);

fs.writeFileSync('src/server/marketScanner.ts', content, 'utf8');
