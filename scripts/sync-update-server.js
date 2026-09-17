const fs = require('node:fs');
const path = require('node:path');

// O .exe é deployado direto na Vercel (via CLI, no workflow do GitHub
// Actions) — nunca passa pelo git. Um arquivo só (Setup), porque a
// Vercel Hobby recusa arquivo > 100MB e duas cópias estouram o limite.
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const manifest = {
  version,
  url: 'https://gustashare.vercel.app/GustaShare-Setup.exe',
  publishedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(root, 'update-server', 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`latest.json -> v${version} (${manifest.url})`);
