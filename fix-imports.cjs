const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('import { auth } from "./lib/firebase";')) {
  code = code.replace(
    "import { AuthScreen } from './components/AuthScreen';",
    "import { AuthScreen } from './components/AuthScreen';\nimport { auth } from './lib/firebase';\nimport { onAuthStateChanged, signOut } from 'firebase/auth';"
  );
  fs.writeFileSync('src/App.tsx', code);
  console.log('Fixed imports in App.tsx');
} else {
  console.log('Already imported');
}
