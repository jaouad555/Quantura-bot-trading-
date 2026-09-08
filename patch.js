const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/const vite = await createViteServer\(\{/g, "const { createServer } = await import('vite');\n      const vite = await createServer({");
fs.writeFileSync('server.ts', code);
