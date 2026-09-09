const fs = require('fs');
const file = 'src/server/db.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("console.log('Local SQLite Database initialized at:', dbPath);", "console.log('Local SQLite Database initialized successfully');");
fs.writeFileSync(file, code);
