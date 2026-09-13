const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Ensure responsive overrides
const overrides = `
/* Additional Responsive Adjustments */
@media (max-width: 1024px) {
  .mode-standard .p-4, .mode-standard .md\\:p-6 {
    padding: 1rem;
  }
}

@media (max-width: 768px) {
  /* Stack grid layouts on mobile */
  .grid-cols-2, .grid-cols-3, .grid-cols-4, .md\\:grid-cols-2, .lg\\:grid-cols-3 {
    grid-template-columns: 1fr !important;
  }
  
  /* Horizontal scroll for wide tables on mobile */
  table {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}

/* Ensure no horizontal scrolling on root */
html, body {
  overflow-x: hidden;
  max-width: 100vw;
}

/* Compact specific adjustments for inner components */
.mode-compact .text-sm {
  font-size: 0.8rem;
}
.mode-compact .text-xs {
  font-size: 0.7rem;
}
.mode-compact h1.text-2xl {
  font-size: 1.25rem;
}
.mode-compact .gap-2 {
  gap: 0.25rem;
}
.mode-compact .p-3 {
  padding: 0.5rem;
}
.mode-compact .py-2 {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}
.mode-compact .px-3 {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
.mode-compact .h-8 {
  height: 1.5rem;
}
.mode-compact .w-8 {
  width: 1.5rem;
}
`;

fs.appendFileSync('src/index.css', overrides);
