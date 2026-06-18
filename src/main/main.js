'use strict'

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

process.on('uncaughtException', err => {
  try { fs.writeFileSync(path.join(process.cwd(), 'error.log'), err.stack || String(err)) } catch (_) {}
})

let win = null
let currentWatcher = null
let watchDebounce = null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadFile(path.join(__dirname, '../renderer/index.html'))

  let allowClose = false
  win.on('close', async e => {
    if (allowClose) return
    e.preventDefault()
    let dirty = false
    try { dirty = await win.webContents.executeJavaScript('window.__isDirty || false') } catch (_) {}
    if (!dirty) { allowClose = true; win.close(); return }
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['閉じずに続ける', '保存せずに閉じる'],
      defaultId: 0,
      cancelId: 0,
      title: '未保存の変更',
      message: '保存していない変更があります。閉じてよいですか？',
    })
    if (response === 1) { allowClose = true; win.close() }
  })

  win.on('closed', () => {
    if (currentWatcher) {
      try { currentWatcher.close() } catch (_) {}
      currentWatcher = null
    }
    win = null
  })
}

ipcMain.handle('saveFile', async (event, filePath, data, options = {}) => {
  try {
    if (options.isBinary) {
      const buffer = Buffer.from(data, 'base64')
      fs.writeFileSync(filePath, buffer)
    } else {
      fs.writeFileSync(filePath, data, 'utf8')
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('openFileDialog', async (event, options = {}) => {
  try {
    if (options.save) {
      const result = await dialog.showSaveDialog(win, options)
      if (result.canceled || !result.filePath) {
        return { filePaths: [] }
      }
      return { filePaths: [result.filePath] }
    } else {
      const result = await dialog.showOpenDialog(win, options)
      if (result.canceled || !result.filePaths) {
        return { filePaths: [] }
      }
      return { filePaths: result.filePaths }
    }
  } catch (err) {
    return { filePaths: [] }
  }
})

ipcMain.handle('readFile', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return { data }
  } catch (err) {
    return { error: err.message }
  }
})

// ─── Project folder IPC ───────────────────────────────────────────────────────

ipcMain.handle('openFolderDialog', async () => {
  try {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'プロジェクトフォルダを開く',
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    return { folderPath: result.filePaths[0] }
  } catch (err) {
    return { error: err.message }
  }
})

function readDirRecursive(dirPath, depth) {
  if (depth > 6) return []
  let entries
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) } catch (_) { return [] }
  const result = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, isDir: true, children: readDirRecursive(fullPath, depth + 1) })
    } else if (entry.name.endsWith('.json')) {
      result.push({ name: entry.name, path: fullPath, isDir: false })
    }
  }
  result.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, 'ja')
  })
  return result
}

ipcMain.handle('readDir', async (event, dirPath) => {
  try {
    return { items: readDirRecursive(dirPath, 0) }
  } catch (err) {
    return { error: err.message }
  }
})

ipcMain.handle('watchFolder', async (event, folderPath) => {
  if (currentWatcher) {
    try { currentWatcher.close() } catch (_) {}
    currentWatcher = null
  }
  try {
    currentWatcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
      if (!filename || filename.endsWith('~') || filename.endsWith('.tmp')) return
      if (watchDebounce) clearTimeout(watchDebounce)
      watchDebounce = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.send('folderChanged', { folderPath })
      }, 400)
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('unwatchFolder', async () => {
  if (currentWatcher) {
    try { currentWatcher.close() } catch (_) {}
    currentWatcher = null
  }
  return { success: true }
})

ipcMain.handle('createProjectFile', async (event, parentDir, name, content) => {
  try {
    const fileName = name.endsWith('.json') ? name : name + '.json'
    const filePath = path.join(parentDir, fileName)
    if (fs.existsSync(filePath)) return { success: false, error: 'ファイルが既に存在します' }
    fs.writeFileSync(filePath, content || '{}', 'utf8')
    return { success: true, filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('createProjectFolder', async (event, parentDir, name) => {
  try {
    const folderPath = path.join(parentDir, name)
    if (fs.existsSync(folderPath)) return { success: false, error: 'フォルダが既に存在します' }
    fs.mkdirSync(folderPath)
    return { success: true, folderPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('deleteProjectItem', async (event, itemPath, isDir) => {
  try {
    if (isDir) {
      fs.rmdirSync(itemPath)
    } else {
      fs.unlinkSync(itemPath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('renameProjectItem', async (event, oldPath, newName) => {
  try {
    const newPath = path.join(path.dirname(oldPath), newName)
    if (fs.existsSync(newPath)) return { success: false, error: '同名のファイルが既に存在します' }
    fs.renameSync(oldPath, newPath)
    return { success: true, newPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (!win) {
    createWindow()
  }
})
