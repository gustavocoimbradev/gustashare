const { app } = require('electron');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const UPDATE_MANIFEST_URL = 'https://gustashare.vercel.app/latest.json';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fetchManifest(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'cache-control': 'no-cache' } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`status ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const request = (currentUrl) => {
      const file = fs.createWriteStream(destPath);
      https
        .get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            file.close();
            request(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            file.close();
            reject(new Error(`status ${res.statusCode}`));
            return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          res.on('data', (chunk) => {
            received += chunk.length;
            if (total && onProgress) onProgress(received / total);
          });
          res.pipe(file);
          file.on('finish', () => file.close(resolve));
        })
        .on('error', (err) => {
          file.close();
          fs.unlink(destPath, () => {});
          reject(err);
        });
    };
    request(url);
  });
}

// Substitui o .exe portátil por fora do processo atual (o processo que
// está rodando é uma cópia extraída em uma pasta temporária, não o
// arquivo .exe que o usuário abriu — por isso o "alvo" real é
// process.env.PORTABLE_EXECUTABLE_FILE, exposto pelo electron-builder).
function spawnSwapAndRelaunch(targetExe, downloadedExe) {
  const batPath = path.join(os.tmpdir(), `gustashare-update-${Date.now()}.bat`);
  const script = [
    '@echo off',
    'timeout /t 1 /nobreak >nul',
    ':retry',
    'del /f /q "%~1" >nul 2>&1',
    'if exist "%~1" (',
    '  timeout /t 1 /nobreak >nul',
    '  goto retry',
    ')',
    'move /y "%~2" "%~1" >nul',
    'start "" "%~1"',
    'del "%~f0"',
  ].join('\r\n');

  fs.writeFileSync(batPath, script);

  spawn('cmd.exe', ['/c', batPath, targetExe, downloadedExe], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

async function checkForUpdate(win, setUpdating) {
  if (!app.isPackaged) return;

  const targetExe = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!targetExe) return; // não é o .exe portátil rodando diretamente

  let manifest;
  try {
    manifest = await fetchManifest(UPDATE_MANIFEST_URL);
  } catch {
    return; // sem internet ou servidor de update fora do ar — ignora
  }

  if (!manifest?.version || !manifest?.url) return;
  if (compareVersions(manifest.version, app.getVersion()) <= 0) return;

  setUpdating(true);
  win.webContents.send('update:status', {
    phase: 'downloading',
    version: manifest.version,
    percent: 0,
  });

  const tmpFile = path.join(os.tmpdir(), `GustaShare-update-${manifest.version}.exe`);

  try {
    await downloadFile(manifest.url, tmpFile, (fraction) => {
      win.webContents.send('update:status', {
        phase: 'downloading',
        version: manifest.version,
        percent: Math.round(fraction * 100),
      });
    });
  } catch {
    setUpdating(false);
    win.webContents.send('update:status', { phase: 'idle' });
    return;
  }

  win.webContents.send('update:status', {
    phase: 'installing',
    version: manifest.version,
    percent: 100,
  });

  spawnSwapAndRelaunch(targetExe, tmpFile);
  app.exit(0);
}

module.exports = { checkForUpdate };
