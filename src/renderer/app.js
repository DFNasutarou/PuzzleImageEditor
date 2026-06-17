// app.js - Main application entry point
// グローバル変数のみ使用（import文なし）

let gridCanvas, pngExporter, svgExporter, catalog, layerManager, mazeDrawer
let isDirty = false
const setDirty = v => { isDirty = v; window.__isDirty = v }
let currentRow = 0, currentCol = 0
let gridVisible = true
let isMazeMode = false

document.addEventListener('DOMContentLoaded', () => {
  const canvasEl = document.getElementById('mainCanvas')
  const defaultGrid = {
    cellSize: 60,
    offsetX: 20,
    offsetY: 20,
    canvasWidth: 600,
    canvasHeight: 600,
    bgColor: '#ffffff',
    gridLineColor: '#cccccc',
    gridLineWidth: 1
  }
  gridCanvas = new window.GridCanvas(canvasEl, defaultGrid)
  pngExporter = new window.PngExporter()
  svgExporter = new window.SvgExporter()
  catalog = new window.ElementCatalog()
  layerManager = new window.LayerManager(gridCanvas.fabricCanvas)
  mazeDrawer = new window.MazeDrawer(gridCanvas.fabricCanvas, gridCanvas.getGridConfig())

  // fabricCanvas の dirty 追跡（グリッド線・迷路線を除外）
  gridCanvas.fabricCanvas.on('object:added', e => {
    const t = e.target?.data?.type
    if (t !== 'grid-line' && t !== 'maze-line') setDirty(true)
  })
  gridCanvas.fabricCanvas.on('object:modified', e => {
    const t = e.target?.data?.type
    if (t !== 'grid-line' && t !== 'maze-line') setDirty(true)
  })
  gridCanvas.fabricCanvas.on('object:removed', e => {
    const t = e.target?.data?.type
    if (t !== 'grid-line' && t !== 'maze-line') setDirty(true)
  })

  // キャンバスクリックで配置セル自動設定（CHG_008）
  gridCanvas.fabricCanvas.on('mouse:down', e => {
    if (isMazeMode) return
    const pt = gridCanvas.fabricCanvas.getPointer(e.e)
    const cell = gridCanvas.getCellFromPoint(pt.x, pt.y)
    currentRow = cell.row
    currentCol = cell.col
    const rowEl = document.getElementById('selectedRow')
    const colEl = document.getElementById('selectedCol')
    if (rowEl) rowEl.textContent = currentRow
    if (colEl) colEl.textContent = currentCol
  })

  renderFontOptions()
  renderShapeOptions()
  renderLayerList()
  bindEvents()
})

function renderFontOptions() {
  const sel = document.getElementById('fontFamily')
  if (!sel) return
  const fonts = catalog.getElements('font')
  sel.innerHTML = fonts.map(f => '<option value="' + f.fontFamily + '">' + f.name + '</option>').join('')
}

function renderShapeOptions() {
  const sel = document.getElementById('shapeName')
  if (!sel) return
  const shapes = catalog.getElements('shape')
  sel.innerHTML = shapes.map(s => '<option value="' + s.shapeName + '">' + s.name + '</option>').join('')
}

// レイヤーUI（CHG_005）
function renderLayerList() {
  const list = document.getElementById('layerList')
  if (!list) return
  const layers = layerManager.getLayers()
  const activeId = layerManager.getActiveLayerId ? layerManager.getActiveLayerId() : null
  list.innerHTML = layers.map(layer => {
    const isActive = layer.id === activeId
    return '<div class="layer-item' + (isActive ? ' layer-active' : '') + '" data-id="' + layer.id + '">' +
      '<span class="layer-name">' + (layer.name || layer.id) + '</span>' +
      '<button class="layer-visibility-btn" data-id="' + layer.id + '">👁</button>' +
      '</div>'
  }).join('')

  list.querySelectorAll('.layer-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.classList.contains('layer-visibility-btn')) return
      layerManager.setActiveLayer(item.dataset.id)
      renderLayerList()
    })
  })
  list.querySelectorAll('.layer-visibility-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      layerManager.toggleLayerVisibility(btn.dataset.id)
      renderLayerList()
    })
  })
}

function bindEvents() {
  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById('panel-' + btn.dataset.tab)?.classList.add('active')
    })
  })

  // グリッド設定リアルタイム反映（CHG_003）
  document.getElementById('gridCellSize')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) {
      gridCanvas.setGridConfig({ cellSize: val })
      mazeDrawer.updateConfig(gridCanvas.getGridConfig())
    }
  })
  document.getElementById('canvasWidth')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) gridCanvas.setGridConfig({ canvasWidth: val })
  })
  document.getElementById('canvasHeight')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) gridCanvas.setGridConfig({ canvasHeight: val })
  })
  document.getElementById('gridOffsetX')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val)) gridCanvas.setGridConfig({ offsetX: val })
  })
  document.getElementById('gridOffsetY')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val)) gridCanvas.setGridConfig({ offsetY: val })
  })
  document.getElementById('gridBgColor')?.addEventListener('input', e => {
    gridCanvas.setGridConfig({ bgColor: e.target.value })
  })
  document.getElementById('gridLineColor')?.addEventListener('input', e => {
    gridCanvas.setGridConfig({ gridLineColor: e.target.value })
  })

  // グリッド表示/非表示（CHG_011）
  document.getElementById('toggleGridBtn')?.addEventListener('click', () => {
    gridVisible = !gridVisible
    gridCanvas.toggleGrid(gridVisible)
    const btn = document.getElementById('toggleGridBtn')
    if (btn) btn.textContent = gridVisible ? 'グリッド非表示' : 'グリッド表示'
  })

  // 迷路モード切り替え（CHG_006）
  document.getElementById('normalModeBtn')?.addEventListener('click', () => {
    isMazeMode = false
    mazeDrawer.disable()
    document.getElementById('normalModeBtn')?.classList.add('active')
    document.getElementById('mazeModeBtn')?.classList.remove('active')
  })
  document.getElementById('mazeModeBtn')?.addEventListener('click', () => {
    isMazeMode = true
    mazeDrawer.enable()
    document.getElementById('mazeModeBtn')?.classList.add('active')
    document.getElementById('normalModeBtn')?.classList.remove('active')
  })

  // レイヤー追加（CHG_005）
  document.getElementById('addLayerBtn')?.addEventListener('click', () => {
    layerManager.addLayer()
    renderLayerList()
  })

  // テキスト追加（CHG_004）
  document.getElementById('addTextBtn')?.addEventListener('click', () => {
    const rawText = document.getElementById('textInput')?.value || 'A'
    const text = rawText.charAt(0)
    const fontFamily = document.getElementById('fontFamily')?.value || 'Arial'
    const fill = document.getElementById('textColor')?.value || '#000000'
    const result = gridCanvas.addElement('text', { row: currentRow, col: currentCol }, { text, fontFamily, fill })
    if (result && typeof result.then === 'function') {
      result.then(obj => { if (obj) layerManager.registerObject(obj) })
    } else if (result) {
      layerManager.registerObject(result)
    }
    setDirty(true)
    showToast('テキストを追加しました')
  })

  // 図形追加
  document.getElementById('addShapeBtn')?.addEventListener('click', () => {
    const shapeName = document.getElementById('shapeName')?.value || 'rect'
    const fill = document.getElementById('shapeFill')?.value || '#4a90d9'
    const stroke = document.getElementById('shapeStroke')?.value || '#2c5f8a'
    const result = gridCanvas.addElement('shape', { row: currentRow, col: currentCol }, { shapeName, fill, stroke, strokeWidth: 2 })
    if (result && typeof result.then === 'function') {
      result.then(obj => { if (obj) layerManager.registerObject(obj) })
    } else if (result) {
      layerManager.registerObject(result)
    }
    setDirty(true)
    showToast('図形を追加しました')
  })

  // 画像追加
  document.getElementById('imageFile')?.addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const opacity = parseFloat(document.getElementById('imageOpacity')?.value) || 1
      const result = await gridCanvas.addElement('image', { row: currentRow, col: currentCol }, { src: ev.target.result, opacity })
      if (result) layerManager.registerObject(result)
      setDirty(true)
      showToast('画像を追加しました')
    }
    reader.readAsDataURL(file)
  })

  // PNG保存
  document.getElementById('savePngBtn')?.addEventListener('click', async () => {
    const dpi = parseInt(document.getElementById('dpiSelect')?.value) || 96
    try {
      showToast('PNG出力中...', 'info')
      const blob = await pngExporter.exportPng(gridCanvas, dpi)
      const result = await window.electronAPI.openFileDialog({ save: true, filters: [{ name: 'PNG Image', extensions: ['png'] }], defaultPath: 'output.png' })
      if (!result.filePaths || !result.filePaths[0]) return
      const path = result.filePaths[0]
      const ab = await blob.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)))
      const saveResult = await window.electronAPI.saveFile(path, b64, { isBinary: true })
      if (saveResult.success) { setDirty(false); showToast('PNGを保存しました: ' + path) }
      else showToast('保存失敗: ' + saveResult.error, 'error')
    } catch (e) { showToast('エラー: ' + e.message, 'error') }
  })

  // SVG保存
  document.getElementById('saveSvgBtn')?.addEventListener('click', async () => {
    try {
      const svgStr = await svgExporter.exportSvg(gridCanvas)
      const result = await window.electronAPI.openFileDialog({ save: true, filters: [{ name: 'SVG', extensions: ['svg'] }], defaultPath: 'output.svg' })
      if (!result.filePaths || !result.filePaths[0]) return
      const saveResult = await window.electronAPI.saveFile(result.filePaths[0], svgStr)
      if (saveResult.success) { setDirty(false); showToast('SVGを保存しました') }
      else showToast('保存失敗: ' + saveResult.error, 'error')
    } catch (e) { showToast('エラー: ' + e.message, 'error') }
  })

  // プロジェクト保存
  document.getElementById('saveProjectBtn')?.addEventListener('click', async () => {
    try {
      const proj = { ...gridCanvas.getGridConfig(), fabricJson: gridCanvas.getSnapshot() }
      const result = await window.electronAPI.openFileDialog({ save: true, filters: [{ name: 'Project JSON', extensions: ['json'] }], defaultPath: 'project.json' })
      if (!result.filePaths || !result.filePaths[0]) return
      const saveResult = await window.electronAPI.saveFile(result.filePaths[0], JSON.stringify(proj))
      if (saveResult.success) { setDirty(false); showToast('プロジェクトを保存しました') }
      else showToast('保存失敗: ' + saveResult.error, 'error')
    } catch (e) { showToast('エラー: ' + e.message, 'error') }
  })

  // プロジェクト読み込み
  document.getElementById('openProjectBtn')?.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.openFileDialog({ filters: [{ name: 'Project JSON', extensions: ['json'] }] })
      if (!result.filePaths || !result.filePaths[0]) return
      const readResult = await window.electronAPI.readFile(result.filePaths[0])
      if (!readResult.data) { showToast('読み込み失敗: ' + readResult.error, 'error'); return }
      const parsed = JSON.parse(readResult.data)
      gridCanvas.setGridConfig(parsed)
      if (parsed.fabricJson) gridCanvas.loadState(parsed.fabricJson)
      setDirty(false)
      showToast('プロジェクトを読み込みました')
    } catch (e) { showToast('エラー: ' + e.message, 'error') }
  })

  // Undo/Redo ボタン
  document.getElementById('undoBtn')?.addEventListener('click', () => { gridCanvas.undo(); setDirty(true) })
  document.getElementById('redoBtn')?.addEventListener('click', () => { gridCanvas.redo() })

  // キーボードショートカット
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); gridCanvas.undo() }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); gridCanvas.redo() }
  })

  // 選択オブジェクト削除 (Delete/Backspace)
  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      const active = gridCanvas.fabricCanvas.getActiveObject()
      if (active) {
        if (active.type === 'activeSelection') {
          active.getObjects().forEach(o => gridCanvas.removeElement(o))
          gridCanvas.fabricCanvas.discardActiveObject()
        } else {
          gridCanvas.removeElement(active)
        }
        gridCanvas.fabricCanvas.renderAll()
      }
    }
  })
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer')
  if (!container) return
  const toast = document.createElement('div')
  toast.className = 'toast toast-' + type
  toast.textContent = msg
  container.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300) }, 3000)
}
