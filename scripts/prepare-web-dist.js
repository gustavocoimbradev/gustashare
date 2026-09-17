const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

// Copia o manifesto do auto-updater pra pasta que a Vercel publica.
// Se o .exe não estiver no dist (build git, sem o workflow Windows),
// tenta reaproveitar o instalador que já está no ar pra não dar 404.
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const src = path.join(root, 'update-server', 'latest.json');
const exeName = 'GustaShare-Portable.exe';
const exeDest = path.join(dist, exeName);
const EXE_URL = 'https://gustashare.vercel.app/GustaShare-Portable.exe';

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}
fs.copyFileSync(src, path.join(dist, 'latest.json'));
console.log('dist/latest.json copiado');

function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, { headers: { 'cache-control': 'no-cache' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        file.close();
        fs.unlink(dest, () => {});
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        download(next, dest, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`status ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.setTimeout(120000, () => {
      req.destroy(new Error('timeout baixando o .exe'));
    });
  });
}

async function keepExe() {
  if (fs.existsSync(exeDest) && fs.statSync(exeDest).size > 1_000_000) {
    console.log('dist/GustaShare-Portable.exe já está no build');
    return;
  }
  try {
    await download(EXE_URL, exeDest);
    console.log(`dist/${exeName} reaproveitado da produção (${fs.statSync(exeDest).size} bytes)`);
  } catch (err) {
    console.warn(`Não deu pra reaproveitar o .exe da produção: ${err.message}`);
  }
}

keepExe().catch((err) => {
  console.warn(err.message);
});
