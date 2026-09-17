const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { checkForUpdate } = require('./updater.js');

const HOME_SIZE = { width: 440, height: 560 };
const ROOM_SIZE = { width: 1280, height: 820 };
const PROTOCOL = 'gustashare';

let pendingSources = [];
let pendingChoice = null;
let updating = false;

// Módulo nativo (Windows) pra captura de janela específica sem os bugs
// do Chromium — ver native/gustashare-capture/. Carrega de forma
// resiliente: se não tiver sido buildado (ex: dev sem `npm run
// build-native`), o app segue funcionando normalmente, só sem essa
// captura alternativa.
let nativeCapture = null;
try {
  nativeCapture = require('../native/gustashare-capture');
} catch (err) {
  console.warn('Módulo nativo de captura indisponível:', err.message);
}

const activeVideoCaptures = new Map();
const activeAudioCaptures = new Map();

// O Electron pode lançar uma exceção síncrona ao processar
// setDisplayMediaRequestHandler quando o callback é chamado de forma
// assíncrona sem vídeo (ex: usuário cancelou o seletor de tela) — isso
// vira um dialog nativo feio de "erro no processo principal". Evita isso
// virar tela de erro pro usuário.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

// ----- Deep link (gustashare://room/CODIGO?nickname=Fulano) -----

function parseDeepLink(link) {
  try {
    const url = new URL(link);
    if (url.protocol !== `${PROTOCOL}:` || url.host !== 'room') return null;
    const roomCode = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!roomCode) return null;
    const nickname = url.searchParams.get('nickname') || '';
    return { roomCode, nickname };
  } catch {
    return null;
  }
}

function findDeepLinkArg(argv) {
  return argv.find((a) => a.startsWith(`${PROTOCOL}://`));
}

function sendDeepLink(win, link) {
  const parsed = parseDeepLink(link);
  if (!parsed || !win) return;
  win.webContents.send('deep-link', parsed);
}

function registerProtocolHandler() {
  // App portátil: precisa apontar o handler pro .exe real (não a cópia
  // temporária extraída em runtime), senão o registro fica quebrado.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL, process.env.PORTABLE_EXECUTABLE_FILE || process.execPath);
  }
}

const startupDeepLink = findDeepLinkArg(process.argv);

function hwndFromSourceId(id) {
  const match = /^window:(\d+):/.exec(id);
  return match ? parseInt(match[1], 10) : null;
}

function createWindow() {
  const initialSize = startupDeepLink ? ROOM_SIZE : HOME_SIZE;

  const win = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    resizable: !!startupDeepLink,
    autoHideMenuBar: true,
    backgroundColor: '#14161a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Bloqueia o fechamento da janela enquanto a atualização estiver
  // baixando/instalando, pra não deixar a troca do .exe pela metade.
  win.on('close', (event) => {
    if (updating) event.preventDefault();
  });

  // Windows 10/11: o picker nativo do SO (janelas + telas + áudio).
  // O handler só roda se o picker do sistema não estiver disponível.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const choice = pendingChoice;
        pendingChoice = null;
        if (choice && !choice.cancelled) {
          const source = pendingSources.find((s) => s.id === choice.id);
          if (source) {
            callback({
              video: source,
              audio: request.audioRequested ? 'loopback' : undefined,
            });
            return;
          }
        }
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 0, height: 0 },
        });
        if (!sources[0]) {
          callback({});
          return;
        }
        callback({
          video: sources[0],
          audio: request.audioRequested ? 'loopback' : undefined,
        });
      } catch (err) {
        console.error('Falha ao responder seletor de tela:', err);
        callback({});
      }
    },
    { useSystemPicker: true }
  );

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.on('did-finish-load', () => {
    if (startupDeepLink) sendDeepLink(win, startupDeepLink);
    checkForUpdate(win, (value) => {
      updating = value;
    });
  });

  return win;
}

ipcMain.on('window:set-mode', (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const size = mode === 'room' ? ROOM_SIZE : HOME_SIZE;
  win.setResizable(mode === 'room');
  win.setSize(size.width, size.height);
  win.center();
});

// O renderer busca a lista de fontes e escolhe ANTES de chamar
// getDisplayMedia (ver comentário em createWindow) — esses dois handlers
// só guardam esse estado pra setDisplayMediaRequestHandler usar.
ipcMain.handle('screen-picker:list-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 220, height: 138 },
    fetchWindowIcons: true,
  });
  pendingSources = sources;
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    isScreen: s.id.startsWith('screen:'),
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

ipcMain.on('screen-picker:set-choice', (_event, choice) => {
  pendingChoice = choice;
});

ipcMain.handle('screen-picker:find-source', async (_event, label) => {
  const name = String(label || '').trim();
  if (!name) return null;
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  });
  const lower = name.toLowerCase();
  const scored = sources
    .map((s) => {
      const sourceName = s.name || '';
      const sourceLower = sourceName.toLowerCase();
      let score = 0;
      if (sourceName === name) score = 3;
      else if (sourceLower === lower) score = 2;
      else if (sourceLower.includes(lower) || lower.includes(sourceLower)) score = 1;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const source = scored[0]?.s;
  if (!source) return null;
  return {
    id: source.id,
    name: source.name,
    isScreen: source.id.startsWith('screen:'),
    hwnd: hwndFromSourceId(source.id),
  };
});

// ----- Captura nativa (janela específica, com áudio isolado do processo) -----

ipcMain.handle('native-capture:resolve-pid', (_event, hwnd) => {
  if (!nativeCapture) return null;
  try {
    return nativeCapture.resolvePidFromHwnd(hwnd);
  } catch (err) {
    console.error('resolvePidFromHwnd falhou:', err);
    return null;
  }
});

ipcMain.handle('native-capture:available', () => !!nativeCapture);

ipcMain.on('native-capture:start-video', (event, { id, hwnd }) => {
  if (!nativeCapture) return;
  const capture = new nativeCapture.VideoCapture();
  activeVideoCaptures.set(id, capture);
  capture.start(hwnd, (err, buffer) => {
    if (err) {
      console.error('captura de vídeo nativa:', err);
      return;
    }
    if (!event.sender.isDestroyed()) {
      event.sender.send(`native-capture:video-frame:${id}`, buffer);
    }
  });
});

ipcMain.on('native-capture:stop-video', (_event, id) => {
  activeVideoCaptures.get(id)?.stop();
  activeVideoCaptures.delete(id);
});

ipcMain.on('native-capture:start-audio', (event, { id, pid }) => {
  if (!nativeCapture) return;
  const capture = new nativeCapture.AudioCapture();
  activeAudioCaptures.set(id, capture);
  capture.start(pid, (err, buffer) => {
    if (err) {
      console.error('captura de áudio nativa:', err);
      return;
    }
    if (!event.sender.isDestroyed()) {
      event.sender.send(`native-capture:audio-chunk:${id}`, buffer);
    }
  });
});

ipcMain.on('native-capture:stop-audio', (_event, id) => {
  activeAudioCaptures.get(id)?.stop();
  activeAudioCaptures.delete(id);
});

// Só uma instância roda por vez: se o usuário clicar num link de convite
// com o app já aberto, reaproveita a janela existente em vez de abrir
// outra.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const link = findDeepLinkArg(argv);
    if (link) sendDeepLink(win, link);
  });

  app.whenReady().then(() => {
    registerProtocolHandler();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
