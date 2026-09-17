const fs = require('node:fs');
const path = require('node:path');

// Só o manifesto vai pra Vercel. O .exe mora no GitHub Releases
// (redirects em vercel.json apontam pra lá).
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const src = path.join(root, 'update-server', 'latest.json');

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}
fs.copyFileSync(src, path.join(dist, 'latest.json'));
fs.rmSync(path.join(dist, 'GustaShare-Setup.exe'), { force: true });
fs.rmSync(path.join(dist, 'GustaShare-Portable.exe'), { force: true });
console.log('dist/latest.json copiado (sem .exe)');
