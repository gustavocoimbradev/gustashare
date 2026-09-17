const fs = require('node:fs');
const path = require('node:path');

// Copia o manifesto do auto-updater pra pasta que a Vercel publica, pra
// /latest.json continuar no mesmo endereço que o .exe desktop já usa.
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const src = path.join(root, 'update-server', 'latest.json');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}
fs.copyFileSync(src, path.join(dist, 'latest.json'));
console.log('dist/latest.json copiado');
