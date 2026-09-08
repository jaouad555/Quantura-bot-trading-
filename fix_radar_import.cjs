const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Remove Radar from react-dom
content = content.replace('Radar, createPortal } from \'react-dom\';', 'createPortal } from \'react-dom\';');

// Add Radar to lucide-react
if (!content.includes('Radar,')) {
    content = content.replace('import {\n  Activity,', 'import {\n  Radar,\n  Activity,');
}

fs.writeFileSync('src/components/Header.tsx', content, 'utf8');
console.log('Fixed Radar import');
