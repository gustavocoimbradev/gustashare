const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

const updateServerDir = path.join(root, 'update-server');
const builtExe = path.join(root, 'release', 'GustaShare-Portable.exe');
const EXE_NAME = 'GustaShare-Portable.exe';

if (!fs.existsSync(builtExe)) {
  console.error('Build não encontrado em release/GustaShare-Portable.exe — rode o build antes.');
  process.exit(1);
}

// Nome de arquivo fixo: cada publish sobrescreve o mesmo .exe, sem
// acumular binário versionado no repo (o vercel.json desativa cache
// nesse arquivo pra garantir que ele nunca fique servindo uma versão
// antiga por trás do CDN).
for (const file of fs.readdirSync(updateServerDir)) {
  if (/^GustaShare-Portable(-.*)?\.exe$/.test(file) && file !== EXE_NAME) {
    fs.unlinkSync(path.join(updateServerDir, file));
  }
}

fs.copyFileSync(builtExe, path.join(updateServerDir, EXE_NAME));

const manifest = {
  version,
  url: `https://gustashare.vercel.app/${EXE_NAME}`,
  publishedAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(updateServerDir, 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(`update-server sincronizado: ${EXE_NAME} (v${version})`);
