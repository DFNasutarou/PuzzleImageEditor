// app.js - Main application entry point
// グローバル変数のみ使用（import文なし）

let gridCanvas, pngExporter, svgExporter, catalog, layerManager, mazeDrawer
let projectExplorer
let currentProjectFile = null
let isDirty = false
const setDirty = v => { isDirty = v; window.__isDirty = v }
let currentRow = 0, currentCol = 0
let gridVisible = true
let isMazeMode = false
let _dragGroupOffsets = null

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
  mazeDrawer.setLayerManager(layerManager)

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

  // キャンバスクリックで配置セル自動設定（CHG_008）+ グループドラッグ準備
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

    // グループ移動用: ドラッグ対象との相対オフセットを記録
    const target = e.target
    if (target && target.data && target.data.groupId) {
      const gid = target.data.groupId
      _dragGroupOffsets = new Map()
      gridCanvas.fabricCanvas.getObjects().forEach(o => {
        if (o !== target && o.data && o.data.groupId === gid) {
          _dragGroupOffsets.set(o, { dx: o.left - target.left, dy: o.top - target.top })
        }
      })
    } else {
      _dragGroupOffsets = null
    }
  })

  // グリッドスナップ + グループ追従
  gridCanvas.fabricCanvas.on('object:moving', e => {
    if (isMazeMode) return
    const obj = e.target
    const { cellSize, offsetX, offsetY, cellGapX = 0, cellGapY = 0 } = gridCanvas.getGridConfig()
    const stepX = cellSize + cellGapX
    const stepY = cellSize + cellGapY
    let snappedLeft, snappedTop
    if (obj.type === 'text' || obj.type === 'i-text') {
      snappedLeft = Math.round((obj.left - offsetX - cellSize / 2) / stepX) * stepX + offsetX + cellSize / 2
      snappedTop = Math.round((obj.top - offsetY - cellSize / 2) / stepY) * stepY + offsetY + cellSize / 2
    } else {
      snappedLeft = Math.round((obj.left - offsetX) / stepX) * stepX + offsetX
      snappedTop = Math.round((obj.top - offsetY) / stepY) * stepY + offsetY
    }
    obj.set({ left: snappedLeft, top: snappedTop })
    obj.setCoords()

    // グループメンバーも追従（同時追加テキストのまとめ移動）
    if (_dragGroupOffsets) {
      _dragGroupOffsets.forEach((offset, member) => {
        member.set({ left: snappedLeft + offset.dx, top: snappedTop + offset.dy })
        member.setCoords()
      })
      gridCanvas.fabricCanvas.requestRenderAll()
    }
  })

  // グリッドスナップ（拡大縮小）
  gridCanvas.fabricCanvas.on('object:scaling', e => {
    if (isMazeMode) return
    const obj = e.target
    const { cellSize, cellGapX = 0, cellGapY = 0 } = gridCanvas.getGridConfig()
    const stepX = cellSize + cellGapX
    const stepY = cellSize + cellGapY
    const corner = e.transform && e.transform.corner
    const orig   = e.transform && e.transform.original

    // flipで scaleX が負になっても正しく扱うよう絶対値で実寸を計算
    const rw = obj.width  * Math.abs(obj.scaleX)
    const rh = obj.height * Math.abs(obj.scaleY)
    // N セル占有時の正しい幅: N*stepX - cellGapX → 逆算して stepX 単位でスナップ
    const sw = Math.max(cellSize, Math.round((rw + cellGapX) / stepX) * stepX - cellGapX)
    const sh = Math.max(cellSize, Math.round((rh + cellGapY) / stepY) * stepY - cellGapY)

    const onLeft = corner === 'tl' || corner === 'ml' || corner === 'bl'
    const onTop  = corner === 'tl' || corner === 'mt' || corner === 'tr'
    let newLeft = obj.left
    let newTop  = obj.top

    if (obj.originX === 'center') {
      // 中心原点（テキスト等）: ハンドル側に中心をずらす
      const dw = sw - rw
      const dh = sh - rh
      newLeft = obj.left + (onLeft ? -dw : dw) / 2
      newTop  = obj.top  + (onTop  ? -dh : dh) / 2
    } else if (orig) {
      // 左上原点（図形・画像）: ドラッグ開始時のアンカー辺を基準に計算
      const origW = obj.width  * Math.abs(orig.scaleX)
      const origH = obj.height * Math.abs(orig.scaleY)
      if (onLeft) newLeft = orig.left + origW - sw
      if (onTop)  newTop  = orig.top  + origH - sh
    } else {
      if (onLeft) newLeft = obj.left + rw - sw
      if (onTop)  newTop  = obj.top  + rh - sh
    }

    obj.set({ scaleX: sw / obj.width, scaleY: sh / obj.height, left: newLeft, top: newTop, flipX: false, flipY: false })
    obj.setCoords()
  })

  projectExplorer = new window.ProjectExplorer()
  projectExplorer.init(document.getElementById('explorer-panel'), openProjectFile, showToast)

  renderFontOptions()
  renderShapeOptions()
  renderLayerList()
  renderTemplateList()
  bindEvents()
  initColorPalettes()
  applyTemplate('hd-standard')
})

function initColorPalettes() {
  const PALETTE_COLORS = [
    // グレースケール 7段階
    '#000000', '#2b2b2b', '#555555', '#808080', '#aaaaaa', '#d4d4d4', '#ffffff',
    // 虹7色（メイン・鮮やか）: 赤・橙・黄・緑・青・藍・紫
    '#ff0000', '#ff8800', '#ffee00', '#00cc00', '#0066ff', '#3300cc', '#9900ff',
    // 虹7色（縁取り・暗め）
    '#990000', '#994400', '#887700', '#006600', '#003399', '#1a0066', '#550099',
    // テトリス7色（メイン）: I・O・T・S・Z・J・L
    '#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000',
    // テトリス7色（縁取り・明るめ）
    '#50ffff', '#ffff50', '#f050ff', '#50ff50', '#ff5050', '#5050ff', '#fff050',
  ]
  document.querySelectorAll('input[type="color"]').forEach(input => {
    const palette = document.createElement('div')
    palette.className = 'color-palette'
    PALETTE_COLORS.forEach(color => {
      const swatch = document.createElement('span')
      swatch.className = 'color-swatch'
      swatch.style.backgroundColor = color
      swatch.title = color
      swatch.addEventListener('click', () => {
        input.value = color
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      palette.appendChild(swatch)
    })
    input.parentNode.insertAdjacentElement('afterend', palette)
  })
}

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
  const canDelete = layers.length > 1
  list.innerHTML = layers.map(layer => {
    const isActive = layer.id === activeId
    const visIcon = layer.visible !== false ? '👁' : '🚫'
    return '<div class="layer-item' + (isActive ? ' layer-active' : '') + '" data-id="' + layer.id + '">' +
      '<span class="layer-name">' + (layer.name || layer.id) + '</span>' +
      '<button class="layer-visibility-btn" data-id="' + layer.id + '" title="表示切替">' + visIcon + '</button>' +
      '<button class="layer-delete-btn" data-id="' + layer.id + '" title="レイヤー削除"' + (canDelete ? '' : ' disabled') + '>✕</button>' +
      '</div>'
  }).join('')

  list.querySelectorAll('.layer-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.classList.contains('layer-visibility-btn')) return
      if (e.target.classList.contains('layer-delete-btn')) return
      layerManager.setActiveLayer(item.dataset.id)
      layerManager.syncLayerSelectability()
      gridCanvas.fabricCanvas.discardActiveObject()
      gridCanvas.fabricCanvas.requestRenderAll()
      syncLayerGridVisibility()
      syncLayerGridConfig()
      syncLayerGridConfigUI()
      renderLayerList()
    })
  })
  list.querySelectorAll('.layer-visibility-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      layerManager.toggleLayerVisibility(btn.dataset.id)
      renderLayerList()
    })
  })
  list.querySelectorAll('.layer-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (layerManager.removeLayer(btn.dataset.id)) {
        mazeDrawer.rebuildLines()
        layerManager.syncLayerSelectability()
        syncLayerGridVisibility()
        syncLayerGridConfig()
        syncLayerGridConfigUI()
        setDirty(true)
        renderLayerList()
      }
    })
  })
}

function syncLayerGridVisibility() {
  gridVisible = layerManager.getActiveLayerGridVisible()
  gridCanvas.toggleGrid(gridVisible)
  const btn = document.getElementById('toggleGridBtn')
  if (btn) btn.textContent = gridVisible ? 'グリッド非表示' : 'グリッド表示'
}

function syncLayerGridConfig() {
  const cfg = layerManager.getActiveLayerGridConfig()
  gridCanvas.applyLayerGridConfig(cfg)
  mazeDrawer.updateConfig(gridCanvas.getGridConfig())
}

function syncLayerGridConfigUI() {
  const cfg = layerManager.getActiveLayerGridConfig()
  const csEl = document.getElementById('layerCellSize')
  const oxEl = document.getElementById('layerOffsetX')
  const oyEl = document.getElementById('layerOffsetY')
  const gxEl = document.getElementById('layerGapX')
  const gyEl = document.getElementById('layerGapY')
  if (csEl) csEl.value = cfg.cellSize
  if (oxEl) oxEl.value = cfg.offsetX
  if (oyEl) oyEl.value = cfg.offsetY
  if (gxEl) gxEl.value = cfg.cellGapX || 0
  if (gyEl) gyEl.value = cfg.cellGapY || 0
}

function syncGridConfigUI() {
  const cfg = gridCanvas.getGridConfig()
  const byId = id => document.getElementById(id)
  if (byId('canvasWidth')) byId('canvasWidth').value = cfg.canvasWidth
  if (byId('canvasHeight')) byId('canvasHeight').value = cfg.canvasHeight
  if (byId('gridBgColor')) byId('gridBgColor').value = cfg.bgColor
  if (byId('gridLineColor')) byId('gridLineColor').value = cfg.gridLineColor
  syncLayerGridConfigUI()
}

function renderTemplateList() {
  const list = document.getElementById('templateList')
  if (!list) return
  const templates = window.BUILTIN_TEMPLATES || []
  list.innerHTML = templates.map(t =>
    '<button class="template-btn" data-id="' + t.id + '">' + t.label + '</button>'
  ).join('')
  list.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTemplate(btn.dataset.id))
  })
}

function applyTemplate(templateId) {
  const loader = new window.TemplateLoader()
  loader.loadTemplate('builtin:' + templateId).then(tmpl => {
    const g = tmpl.defaultGrid
    const offsetX = g.offsetX !== undefined ? g.offsetX : 20
    const offsetY = g.offsetY !== undefined ? g.offsetY : 20
    const canvasWidth = g.canvasWidth !== undefined ? g.canvasWidth : (offsetX + g.cols * g.cellSize + offsetX)
    const canvasHeight = g.canvasHeight !== undefined ? g.canvasHeight : (offsetY + g.rows * g.cellSize + offsetY)
    gridCanvas.clearCanvas()
    gridCanvas.setGridConfig({
      cellSize: g.cellSize,
      offsetX,
      offsetY,
      canvasWidth,
      canvasHeight,
      bgColor: g.bgColor || '#ffffff',
      gridLineColor: g.gridLineColor || '#cccccc',
      gridLineWidth: g.gridLineWidth !== undefined ? g.gridLineWidth : 1
    })
    mazeDrawer.updateConfig(gridCanvas.getGridConfig())
    layerManager.setLayerGridConfig(layerManager.getActiveLayerId(), {
      cellSize: g.cellSize, offsetX, offsetY
    })
    layerManager.syncLayerSelectability()
    syncGridConfigUI()
    setDirty(false)
    showToast(tmpl.label + ' テンプレートを適用しました')
  }).catch(err => showToast('テンプレート読み込み失敗: ' + err.message, 'error'))
}

function bindEvents() {
  // ツールナビ切り替え（迷路モード自動連動）
  document.querySelectorAll('.tool-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-nav-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById('tool-panel-' + btn.dataset.panel)?.classList.add('active')
      if (btn.dataset.panel === 'maze') {
        isMazeMode = true
        mazeDrawer.enable()
        gridCanvas.fabricCanvas.selection = false
      } else if (isMazeMode) {
        isMazeMode = false
        mazeDrawer.disable()
        gridCanvas.fabricCanvas.selection = true
      }
    })
  })

  // グリッドパネル: 画面サイズ・色のリアルタイム反映
  document.getElementById('canvasWidth')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) { gridCanvas.setGridConfig({ canvasWidth: val }); mazeDrawer.updateConfig(gridCanvas.getGridConfig()) }
  })
  document.getElementById('canvasHeight')?.addEventListener('input', e => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val > 0) { gridCanvas.setGridConfig({ canvasHeight: val }); mazeDrawer.updateConfig(gridCanvas.getGridConfig()) }
  })
  document.getElementById('gridBgColor')?.addEventListener('input', e => {
    gridCanvas.setGridConfig({ bgColor: e.target.value })
  })
  document.getElementById('gridLineColor')?.addEventListener('input', e => {
    gridCanvas.setGridConfig({ gridLineColor: e.target.value })
  })

  // レイヤーパネル: セルサイズ・オフセット・ギャップのリアルタイム反映（レイヤーごと）
  const onLayerGridInput = () => {
    const cellSize = parseInt(document.getElementById('layerCellSize')?.value) || 60
    const offsetX = parseInt(document.getElementById('layerOffsetX')?.value) || 0
    const offsetY = parseInt(document.getElementById('layerOffsetY')?.value) || 0
    const cellGapX = parseInt(document.getElementById('layerGapX')?.value) || 0
    const cellGapY = parseInt(document.getElementById('layerGapY')?.value) || 0
    layerManager.setLayerGridConfig(layerManager.getActiveLayerId(), { cellSize, offsetX, offsetY, cellGapX, cellGapY })
    gridCanvas.applyLayerGridConfig({ cellSize, offsetX, offsetY, cellGapX, cellGapY })
  }
  document.getElementById('layerCellSize')?.addEventListener('input', () => { onLayerGridInput(); mazeDrawer.updateConfig(gridCanvas.getGridConfig()) })
  document.getElementById('layerOffsetX')?.addEventListener('input', () => { onLayerGridInput(); mazeDrawer.updateConfig(gridCanvas.getGridConfig()) })
  document.getElementById('layerOffsetY')?.addEventListener('input', () => { onLayerGridInput(); mazeDrawer.updateConfig(gridCanvas.getGridConfig()) })
  // Gap入力中は空欄のときmazeDrawer更新をスキップ。blur確定時に必ず更新
  const gapXEl = document.getElementById('layerGapX')
  const gapYEl = document.getElementById('layerGapY')
  gapXEl?.addEventListener('input', () => { onLayerGridInput(); if (gapXEl.value !== '') mazeDrawer.updateConfig(gridCanvas.getGridConfig()) })
  gapYEl?.addEventListener('input', () => { onLayerGridInput(); if (gapYEl.value !== '') mazeDrawer.updateConfig(gridCanvas.getGridConfig()) })
  gapXEl?.addEventListener('blur', () => mazeDrawer.updateConfig(gridCanvas.getGridConfig()))
  gapYEl?.addEventListener('blur', () => mazeDrawer.updateConfig(gridCanvas.getGridConfig()))

  // 迷路: 線のスタイル変更
  const updateMazeStyle = () => {
    const color = document.getElementById('mazeLineColor')?.value || '#000000'
    const width = parseInt(document.getElementById('mazeLineWidth')?.value) || 3
    mazeDrawer.setStyle(color, width)
  }
  document.getElementById('mazeLineColor')?.addEventListener('input', updateMazeStyle)
  document.getElementById('mazeLineWidth')?.addEventListener('input', updateMazeStyle)

  // グリッド表示/非表示（レイヤーごとに状態保持）
  document.getElementById('toggleGridBtn')?.addEventListener('click', () => {
    gridVisible = !gridVisible
    gridCanvas.toggleGrid(gridVisible)
    layerManager.setLayerGridVisible(layerManager.getActiveLayerId(), gridVisible)
    const btn = document.getElementById('toggleGridBtn')
    if (btn) btn.textContent = gridVisible ? 'グリッド非表示' : 'グリッド表示'
  })

  // レイヤー追加（CHG_005）
  document.getElementById('addLayerBtn')?.addEventListener('click', () => {
    layerManager.addLayer(null, layerManager.getActiveLayerGridConfig())
    renderLayerList()
  })

  // テキスト追加（CHG_004）: 複数文字は右へ連続配置、同時追加はグループ化
  document.getElementById('addTextBtn')?.addEventListener('click', () => {
    const text = document.getElementById('textInput')?.value || ''
    if (!text) return
    const fontFamily = document.getElementById('fontFamily')?.value || 'Arial'
    const fill = document.getElementById('textColor')?.value || '#000000'
    const groupId = text.length > 1 ? ('tg-' + Date.now()) : null
    let col = currentCol
    for (const char of text) {
      const opts = { text: char, fontFamily, fill }
      if (groupId) opts.groupId = groupId
      const result = gridCanvas.addElement('text', { row: currentRow, col }, opts)
      if (result) layerManager.registerObject(result)
      col++
    }
    currentCol = col
    const colEl = document.getElementById('selectedCol')
    if (colEl) colEl.textContent = currentCol
    setDirty(true)
    showToast(text.length + '文字を追加しました')
  })

  // 「透過」チェックで塗り色ピッカーを無効化
  document.getElementById('shapeFillNone')?.addEventListener('change', e => {
    const colorInput = document.getElementById('shapeFill')
    if (colorInput) colorInput.disabled = e.target.checked
  })

  // 図形追加
  document.getElementById('addShapeBtn')?.addEventListener('click', () => {
    const shapeName = document.getElementById('shapeName')?.value || 'rect'
    const fillNone = document.getElementById('shapeFillNone')?.checked
    const fill = fillNone ? null : (document.getElementById('shapeFill')?.value || '#4a90d9')
    const stroke = document.getElementById('shapeStroke')?.value || '#2c5f8a'
    const result = gridCanvas.addElement('shape', { row: currentRow, col: currentCol }, { shapeName, fill, stroke, strokeWidth: 2 })
    if (result) layerManager.registerObject(result)
    currentCol++
    const colEl = document.getElementById('selectedCol')
    if (colEl) colEl.textContent = currentCol
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
      currentCol++
      const colEl = document.getElementById('selectedCol')
      if (colEl) colEl.textContent = currentCol
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

  // プロジェクト上書き保存 (Ctrl+S)
  document.getElementById('saveProjectBtn')?.addEventListener('click', async () => {
    if (currentProjectFile) await saveProjectToFile(currentProjectFile)
    else await saveProjectAs()
  })

  // 名前をつけて保存
  document.getElementById('saveProjectAsBtn')?.addEventListener('click', saveProjectAs)

  // フォルダを開く
  document.getElementById('openProjectBtn')?.addEventListener('click', () => {
    if (projectExplorer) projectExplorer._openFolderDialog()
  })

  const afterUndoRedo = () => {
    mazeDrawer.rebuildLines()
    layerManager.rebuildFromCanvas()
    layerManager.syncLayerSelectability()
    syncGridConfigUI()
    syncLayerGridVisibility()
    syncLayerGridConfig()
  }

  // Undo/Redo ボタン
  document.getElementById('undoBtn')?.addEventListener('click', () => {
    const p = gridCanvas.undo()
    if (p) p.then(afterUndoRedo)
    setDirty(true)
  })
  document.getElementById('redoBtn')?.addEventListener('click', () => {
    const p = gridCanvas.redo()
    if (p) p.then(afterUndoRedo)
  })

  // キーボードショートカット
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
      e.preventDefault()
      const p = gridCanvas.undo()
      if (p) p.then(afterUndoRedo)
    }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault()
      const p = gridCanvas.redo()
      if (p) p.then(afterUndoRedo)
    }
    if (e.ctrlKey && !e.shiftKey && e.key === 's') {
      e.preventDefault()
      if (currentProjectFile) saveProjectToFile(currentProjectFile)
      else saveProjectAs()
    }
  })

  // 選択オブジェクト削除 (Delete/Backspace)
  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      const active = gridCanvas.fabricCanvas.getActiveObject()
      if (!active) return
      // getObjects() の生配列を走査中に変更しないようスナップショットを取る
      const targets = active.type === 'activeSelection' ? [...active.getObjects()] : [active]
      gridCanvas.fabricCanvas.discardActiveObject()
      targets.forEach(o => {
        gridCanvas.fabricCanvas.remove(o)
        layerManager.unregisterObject(o)
      })
      gridCanvas.fabricCanvas.renderAll()
      gridCanvas._pushUndo()
      setDirty(true)
    }
  })
}

async function openProjectFile(filePath) {
  if (!filePath) { currentProjectFile = null; return }
  if (isDirty) {
    const ok = confirm('保存されていない変更があります。このファイルを開きますか？')
    if (!ok) return
  }
  try {
    const readResult = await window.electronAPI.readFile(filePath)
    if (readResult.error) { showToast('読み込み失敗: ' + readResult.error, 'error'); return }
    const parsed = JSON.parse(readResult.data)
    gridCanvas.cancelDebouncedUndo()
    const fileName = filePath.replace(/\\/g, '/').split('/').pop()
    const finalize = () => {
      mazeDrawer.rebuildLines()

      // layerManagerをリセットし、保存済みレイヤー設定を復元
      layerManager.reset()
      const cfg = gridCanvas.getGridConfig()
      if (parsed.layers && parsed.layers.length > 0) {
        parsed.layers.forEach((savedLayer, i) => {
          let targetId
          if (i === 0) {
            targetId = layerManager.getActiveLayerId()
            const layer = layerManager.getLayers()[0]
            if (layer) layer.name = savedLayer.name || 'Layer 1'
          } else {
            const newLayer = layerManager.addLayer(savedLayer.name || ('Layer ' + (i + 1)))
            targetId = newLayer.id
          }
          layerManager.setLayerGridConfig(targetId, {
            cellSize: savedLayer.cellSize !== undefined ? savedLayer.cellSize : cfg.cellSize,
            offsetX: savedLayer.offsetX !== undefined ? savedLayer.offsetX : cfg.offsetX,
            offsetY: savedLayer.offsetY !== undefined ? savedLayer.offsetY : cfg.offsetY,
            cellGapX: savedLayer.cellGapX !== undefined ? savedLayer.cellGapX : 0,
            cellGapY: savedLayer.cellGapY !== undefined ? savedLayer.cellGapY : 0
          })
        })
        if (parsed.activeLayerId) layerManager.setActiveLayer(parsed.activeLayerId)
      } else {
        // 旧形式: gridConfigでアクティブレイヤーをリセット
        layerManager.setLayerGridConfig(layerManager.getActiveLayerId(), {
          cellSize: cfg.cellSize, offsetX: cfg.offsetX, offsetY: cfg.offsetY,
          cellGapX: cfg.cellGapX || 0, cellGapY: cfg.cellGapY || 0
        })
      }

      layerManager.rebuildFromCanvas()
      layerManager.syncLayerSelectability()
      syncGridConfigUI()
      syncLayerGridVisibility()
      syncLayerGridConfig()
      renderLayerList()
      currentProjectFile = filePath
      if (projectExplorer) projectExplorer.setCurrentFile(filePath)
      setDirty(false)
      showToast(fileName + ' を開きました')
    }
    if (parsed.fabricJson) {
      gridCanvas.setGridConfig(parsed)
      gridCanvas.loadState(parsed.fabricJson).then(finalize)
    } else {
      gridCanvas.clearCanvas()
      finalize()
    }
  } catch (e) {
    showToast('エラー: ' + e.message, 'error')
  }
}

async function saveProjectToFile(filePath) {
  try {
    const layersData = layerManager.getLayers().map(l => ({
      id: l.id, name: l.name, visible: l.visible !== false, gridVisible: l.gridVisible !== false,
      cellSize: l.cellSize, offsetX: l.offsetX, offsetY: l.offsetY,
      cellGapX: l.cellGapX || 0, cellGapY: l.cellGapY || 0
    }))
    const proj = { ...gridCanvas.getGridConfig(), layers: layersData, activeLayerId: layerManager.getActiveLayerId(), fabricJson: gridCanvas.getSnapshot() }
    const result = await window.electronAPI.saveFile(filePath, JSON.stringify(proj, null, 2))
    if (result.success) {
      setDirty(false)
      showToast(filePath.replace(/\\/g, '/').split('/').pop() + ' を保存しました')
    } else {
      showToast('保存失敗: ' + result.error, 'error')
    }
  } catch (e) {
    showToast('エラー: ' + e.message, 'error')
  }
}

async function saveProjectAs() {
  try {
    const result = await window.electronAPI.openFileDialog({
      save: true,
      filters: [{ name: 'Project JSON', extensions: ['json'] }],
      defaultPath: 'project.json',
    })
    if (!result.filePaths || !result.filePaths[0]) return
    const filePath = result.filePaths[0]
    await saveProjectToFile(filePath)
    currentProjectFile = filePath
    if (projectExplorer) projectExplorer.setCurrentFile(filePath)
  } catch (e) {
    showToast('エラー: ' + e.message, 'error')
  }
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
