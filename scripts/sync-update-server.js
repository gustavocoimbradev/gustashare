const fs = require('node:fs');
const path = require('node:path');

// O instalador (~104MB) não cabe na Vercel Hobby (limite 100MB).
// Ele vai pra um GitHub Release publicado; aqui só apontamos o latest.json
// e os redirects da Vercel pra esse arquivo.
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const repo = process.env.GITHUB_REPOSITORY;

if (!repo) {
  throw new Error('GITHUB_REPOSITORY não definido — rode este script no GitHub Actions.');
}

const latestUrl = `https://github.com/${repo}/releases/latest/download/GustaShare-Setup.exe`;
const versionUrl = `https://github.com/${repo}/releases/download/v${version}/GustaShare-Setup.exe`;

const manifest = {
  version,
  url: versionUrl,
  publishedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(root, 'update-server', 'latest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);

function setExeRedirects(filePath) {
  if (!fs.existsSync(filePath)) return;
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  json.headers = (json.headers || []).filter((h) => h.source === '/latest.json');
  json.redirects = [
    { source: '/GustaShare-Setup.exe', destination: latestUrl, permanent: false },
    { source: '/GustaShare-Portable.exe', destination: latestUrl, permanent: false },
  ];
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

setExeRedirects(path.join(root, 'scripts', 'vercel-static.json'));
setExeRedirects(path.join(root, 'vercel.json'));
setExeRedirects(path.join(root, 'update-server', 'vercel.json'));

console.log(`latest.json -> v${version} (${manifest.url})`);
