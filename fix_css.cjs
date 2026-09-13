const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Remove the overly aggressive compact overrides
css = css.replace('.mode-compact .h-8 {\n  height: 1.5rem;\n}', '');
css = css.replace('.mode-compact .w-8 {\n  width: 1.5rem;\n}', '');
css = css.replace('.mode-compact .gap-2 {\n  gap: 0.25rem;\n}', '');

fs.writeFileSync('src/index.css', css);
