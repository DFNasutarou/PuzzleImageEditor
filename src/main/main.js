'use strict'

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

process.on('uncaughtException', err => {
  try { fs.writeFileSync(path.join(process.cwd(), 'error.log'), err.stack || String(err)) } catch (_) {}
})

let win = null

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
