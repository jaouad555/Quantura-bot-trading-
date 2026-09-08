const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf-8');
const script = `
<script>
window.addEventListener('error', function(e) {
  fetch('/api/log-error', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ message: e.message, filename: e.filename, lineno: e.lineno }) }).catch(()=>{});
});
const oldError = console.error;
console.error = function(...args) {
  fetch('/api/log-error', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ message: args.join(' ') }) }).catch(()=>{});
  oldError.apply(console, args);
};
</script>
`;
if (!html.includes('/api/log-error')) {
  html = html.replace('<head>', '<head>' + script);
  fs.writeFileSync('index.html', html);
}
