const fs = require('node:fs');
const path = require('node:path');

// O .exe agora e publicado como GitHub Release (build feita no CI, em
// Windows real) em vez de ser commitado no repo — o binario passava dos
// 100MB, que e o limite duro do GitHub para arquivos versionados. Este
// script so precisa apontar o latest.json pra URL do release da versao
// atual; roda dentro do workflow do GitHub Actions, depois do build.
const REPO = 'gustavocoimbradev/gustashare';

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const manifest = {
  version,
  // "latest/download" sempre resolve pro asset da release mais recente,
  // sem precisar bater com o nome exato da tag.
  url: `https://github.com/${REPO}/releases/latest/download/GustaShare-Portable.exe`,
  publishedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(root, 'update-server', 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`latest.json -> v${version} (${manifest.url})`);
