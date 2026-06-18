const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 既存
  saveFile: (filePath, data, options) => ipcRenderer.invoke('saveFile', filePath, data, options),
  openFileDialog: (options) => ipcRenderer.invoke('openFileDialog', options),
  readFile: (filePath) => ipcRenderer.invoke('readFile', filePath),
  // プロジェクトフォルダ管理
  openFolderDialog: () => ipcRenderer.invoke('openFolderDialog'),
  readDir: (dirPath) => ipcRenderer.invoke('readDir', dirPath),
  watchFolder: (folderPath) => ipcRenderer.invoke('watchFolder', folderPath),
  unwatchFolder: () => ipcRenderer.invoke('unwatchFolder'),
  createProjectFile: (parentDir, name, content) => ipcRenderer.invoke('createProjectFile', parentDir, name, content),
  createProjectFolder: (parentDir, name) => ipcRenderer.invoke('createProjectFolder', parentDir, name),
  deleteProjectItem: (itemPath, isDir) => ipcRenderer.invoke('deleteProjectItem', itemPath, isDir),
  renameProjectItem: (oldPath, newName) => ipcRenderer.invoke('renameProjectItem', oldPath, newName),
  onFolderChanged: (cb) => ipcRenderer.on('folderChanged', (_, data) => cb(data)),
  offFolderChanged: () => ipcRenderer.removeAllListeners('folderChanged'),
})
