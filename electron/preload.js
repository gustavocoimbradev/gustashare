const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gustashare', {
  setWindowMode: (mode) => ipcRenderer.send('window:set-mode', mode),

  onScreenPickerSources: (callback) => {
    const listener = (_event, sources) => callback(sources);
    ipcRenderer.on('screen-picker:sources', listener);
    return () => ipcRenderer.removeListener('screen-picker:sources', listener);
  },
  chooseScreenSource: (choice) => ipcRenderer.send('screen-picker:choice', choice),

  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update:status', listener);
    return () => ipcRenderer.removeListener('update:status', listener);
  },
});
