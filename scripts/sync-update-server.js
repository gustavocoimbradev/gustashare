const fs = require('node:fs');
const path = require('node:path');

// O .exe e deployado direto na Vercel (via CLI, dentro do workflow do
// GitHub Actions) — nunca passa pelo git, entao nunca esbarra no limite
// de 100MB nem depende do repositorio ser publico. Este script so
// escreve o latest.json apontando pra URL fixa do arquivo na Vercel;
// o vercel.json em update-server/ desativa cache nesse arquivo, entao
// cada deploy novo fica visivel na hora.
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const manifest = {
  version,
  url: 'https://gustashare.vercel.app/GustaShare-Portable.exe',
  publishedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(root, 'update-server', 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`latest.json -> v${version} (${manifest.url})`);
