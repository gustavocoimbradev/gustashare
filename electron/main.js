const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const { checkForUpdate } = require('./updater.js');

const HOME_SIZE = { width: 440, height: 560 };
const ROOM_SIZE = { width: 1280, height: 820 };
const PROTOCOL = 'gustashare';

let pendingSources = [];
let updating = false;

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

  // No Windows 10/11 modernos, o proprio SO mostra o dialogo nativo de
  // "compartilhar tela" (telas, janelas e, quando suportado, audio isolado
  // por aplicativo) e o handler abaixo nem chega a ser chamado. Ele so roda
  // como fallback (SO sem o seletor nativo), exibindo nosso proprio seletor
  // dentro do app para garantir que sempre exista essa escolha.
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 220, height: 138 },
          fetchWindowIcons: true,
        })
        .then((sources) => {
          pendingSources = sources;
          win.webContents.send(
            'screen-picker:sources',
            sources.map((s) => ({
              id: s.id,
              name: s.name,
              isScreen: s.id.startsWith('screen:'),
              thumbnail: s.thumbnail.toDataURL(),
              appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
            }))
          );

          ipcMain.once('screen-picker:choice', (_event, choice) => {
            const source = !choice?.cancelled && pendingSources.find((s) => s.id === choice.id);
            try {
              if (!source) {
                callback({});
                return;
              }
              callback({
                video: source,
                audio: choice.shareAudio && source.id.startsWith('screen:') ? 'loopback' : undefined,
              });
            } catch (err) {
              // Electron pode lançar uma exceção síncrona aqui ao negar o
              // pedido (callback({})) de forma assíncrona — ver nota no
              // topo do arquivo. Sem isso, vira um dialog de erro nativo.
              console.error('Falha ao responder seletor de tela:', err);
            }
          });
        });
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
