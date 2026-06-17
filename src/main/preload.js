const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filePath, data, options) => ipcRenderer.invoke('saveFile', filePath, data, options),
  openFileDialog: (options) => ipcRenderer.invoke('openFileDialog', options),
  readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
})
