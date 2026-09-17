const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gustashare', {
  setWindowMode: (mode) => ipcRenderer.send('window:set-mode', mode),

  listScreenSources: () => ipcRenderer.invoke('screen-picker:list-sources'),
  setScreenPickerChoice: (choice) => ipcRenderer.send('screen-picker:set-choice', choice),
  findCaptureSource: (label) => ipcRenderer.invoke('screen-picker:find-source', label),

  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },

  onDeepLink: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('deep-link', listener);
    return () => ipcRenderer.removeListener('deep-link', listener);
  },

  // Captura nativa (janela específica sem tela preta + áudio isolado do
  // processo) — ver native/gustashare-capture/.
  nativeCaptureAvailable: () => ipcRenderer.invoke('native-capture:available'),
  resolvePidFromHwnd: (hwnd) => ipcRenderer.invoke('native-capture:resolve-pid', hwnd),

  startNativeVideoCapture: (id, hwnd, onFrame) => {
    const channel = `native-capture:video-frame:${id}`;
    const listener = (_event, buffer) => onFrame(buffer);
    ipcRenderer.on(channel, listener);
    ipcRenderer.send('native-capture:start-video', { id, hwnd });
    return () => {
      ipcRenderer.removeListener(channel, listener);
      ipcRenderer.send('native-capture:stop-video', id);
    };
  },

  startNativeAudioCapture: (id, pid, onChunk) => {
    const channel = `native-capture:audio-chunk:${id}`;
    const listener = (_event, buffer) => onChunk(buffer);
    ipcRenderer.on(channel, listener);
    ipcRenderer.send('native-capture:start-audio', { id, pid });
    return () => {
      ipcRenderer.removeListener(channel, listener);
      ipcRenderer.send('native-capture:stop-audio', id);
    };
  },
});
