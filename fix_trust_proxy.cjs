const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('trust proxy')) {
  content = content.replace(
    'app.use(express.json());',
    "app.set('trust proxy', 1);\napp.use(express.json());"
  );
  fs.writeFileSync('server.ts', content, 'utf8');
  console.log('Fixed trust proxy');
}
