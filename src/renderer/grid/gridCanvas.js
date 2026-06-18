/**
 * GridCanvas (UNT-001)
 * fabric.js v6 ベースのグリッドキャンバス管理クラス。
 * 依存: window.ElementPlacer, window.EditorUndoManager, グローバル fabric
 */
class GridCanvas {
  constructor(canvasEl, gridConfig) {
    this.gridConfig = Object.assign(
      {
        cellSize: 60,
        offsetX: 20,
        offsetY: 20,
        canvasWidth: 600,
        canvasHeight: 600,
        bgColor: '#ffffff',
        gridLineColor: '#cccccc',
        gridLineWidth: 1,
        cellGapX: 0,
        cellGapY: 0
      },
      gridConfig
    )
    this.fabricCanvas = new fabric.Canvas(canvasEl, {
      width: this.gridConfig.canvasWidth,
      height: this.gridConfig.canvasHeight,
      backgroundColor: this.gridConfig.bgColor,
      selection: true
    })
    this.placer = new window.ElementPlacer(this.gridConfig)
    this.undoMgr = new window.EditorUndoManager(50)
    this._gridLines = []
    this._gridVisible = true
    this._undoDebounceTimer = null
    this._fixingSelection = false
    this.drawGrid()
    // 変更をundoスタックに記録
    this.fabricCanvas.on('object:modified', () => this._pushUndo())
    // グリッド線・迷路線が範囲選択に含まれないよう強制除外
    this.fabricCanvas.on('selection:created', () => this._excludeSystemLinesFromSelection())
    this.fabricCanvas.on('selection:updated', () => this._excludeSystemLinesFromSelection())
    // 初期状態を記録
    this._pushUndo()
  }

  _excludeSystemLinesFromSelection() {
    if (this._fixingSelection) return
    const canvas = this.fabricCanvas
    const sel = canvas.getActiveObject()
    if (!sel) return
    const isSystem = o => o.data && (o.data.type === 'grid-line' || o.data.type === 'maze-line')
    if (sel.type === 'activeSelection') {
      const sysObjs = sel.getObjects().filter(isSystem)
      if (sysObjs.length === 0) return
      const keepObjs = sel.getObjects().filter(o => !isSystem(o))
      this._fixingSelection = true
      canvas.discardActiveObject()
      if (keepObjs.length === 1) {
        canvas.setActiveObject(keepObjs[0])
      } else if (keepObjs.length > 1) {
        canvas.setActiveObject(new fabric.ActiveSelection(keepObjs, { canvas }))
      }
      canvas.requestRenderAll()
      this._fixingSelection = false
    } else if (isSystem(sel)) {
      this._fixingSelection = true
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      this._fixingSelection = false
    }
  }

  _pushUndo() {
    const allObjs = this.fabricCanvas.getObjects()
    const gridLineSet = new Set(this._gridLines)
    const fabricJson = this.fabricCanvas.toJSON()
    fabricJson.objects = (fabricJson.objects || []).filter((_, i) => !gridLineSet.has(allObjs[i]))
    this.undoMgr.push(JSON.stringify({
      _v: 2,
      gridConfig: Object.assign({}, this.gridConfig),
      fabricJson: fabricJson
    }))
  }

  drawGrid() {
    this._gridLines.forEach(l => this.fabricCanvas.remove(l))
    this._gridLines = []
    const { cellSize, offsetX, offsetY, canvasWidth, canvasHeight, gridLineColor, gridLineWidth, cellGapX = 0, cellGapY = 0 } = this.gridConfig
    const stepX = cellSize + cellGapX
    const stepY = cellSize + cellGapY
    const rows = Math.floor((canvasHeight - offsetY) / stepY)
    const cols = Math.floor((canvasWidth - offsetX) / stepX)
    const opacity = this._gridVisible ? 1 : 0

    if (cellGapX === 0 && cellGapY === 0) {
      const addLine = (x1, y1, x2, y2) => {
        const l = new fabric.Line([x1, y1, x2, y2], {
          stroke: gridLineColor, strokeWidth: gridLineWidth,
          selectable: false, evented: false, excludeFromExport: false, opacity,
          data: { type: 'grid-line' }
        })
        this.fabricCanvas.add(l)
        this.fabricCanvas.sendObjectToBack(l)
        this._gridLines.push(l)
      }
      for (let r = 0; r <= rows; r++) {
        addLine(offsetX, offsetY + r * cellSize, offsetX + cols * cellSize, offsetY + r * cellSize)
      }
      for (let c = 0; c <= cols; c++) {
        addLine(offsetX + c * cellSize, offsetY, offsetX + c * cellSize, offsetY + rows * cellSize)
      }
    } else {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rect = new fabric.Rect({
            left: offsetX + c * stepX,
            top: offsetY + r * stepY,
            width: cellSize,
            height: cellSize,
            fill: 'transparent',
            stroke: gridLineColor,
            strokeWidth: gridLineWidth,
            selectable: false, evented: false, opacity,
            data: { type: 'grid-line' }
          })
          this.fabricCanvas.add(rect)
          this.fabricCanvas.sendObjectToBack(rect)
          this._gridLines.push(rect)
        }
      }
    }
    this.fabricCanvas.renderAll()
  }

  toggleGrid(visible) {
    this._gridVisible = visible
    this._gridLines.forEach(l => l.set('opacity', visible ? 1 : 0))
    this.fabricCanvas.renderAll()
  }

  getCellFromPoint(x, y) {
    const { cellSize, offsetX, offsetY, cellGapX = 0, cellGapY = 0 } = this.gridConfig
    const col = Math.max(0, Math.floor((x - offsetX) / (cellSize + cellGapX)))
    const row = Math.max(0, Math.floor((y - offsetY) / (cellSize + cellGapY)))
    return { row, col }
  }

  addElement(type, cellPos, options) {
    let result
    if (type === 'text') {
      result = this.placer.placeText(this.fabricCanvas, cellPos, options)
      this._pushUndo()
      return result
    } else if (type === 'shape') {
      result = this.placer.placeShape(this.fabricCanvas, cellPos, options)
      this._pushUndo()
      return result
    } else if (type === 'image') {
      return this.placer.placeImage(this.fabricCanvas, cellPos, options).then(img => {
        this._pushUndo()
        return img
      })
    } else {
      throw new TypeError('不明なtype: ' + type)
    }
  }

  removeElement(obj) {
    this.fabricCanvas.remove(obj)
    this.fabricCanvas.renderAll()
    this._pushUndo()
  }

  getSnapshot() {
    const allObjs = this.fabricCanvas.getObjects()
    const gridLineSet = new Set(this._gridLines)
    const json = this.fabricCanvas.toJSON()
    json.objects = (json.objects || []).filter((_, i) => !gridLineSet.has(allObjs[i]))
    return JSON.stringify(json)
  }

  loadState(fabricJsonStr) {
    const json = typeof fabricJsonStr === 'string' ? JSON.parse(fabricJsonStr) : fabricJsonStr
    // fabricJsonがテンプレートのdefaultGridを含む場合はグリッド設定を更新
    if (json.cellSize) {
      const configUpdate = { cellSize: json.cellSize }
      if (json.offsetX !== undefined) configUpdate.offsetX = json.offsetX
      if (json.offsetY !== undefined) configUpdate.offsetY = json.offsetY
      if (json.canvasWidth !== undefined) configUpdate.canvasWidth = json.canvasWidth
      if (json.canvasHeight !== undefined) configUpdate.canvasHeight = json.canvasHeight
      this._setGridConfigInternal(configUpdate)
    }
    const afterLoad = () => {
      this.drawGrid()
      this.fabricCanvas.renderAll()
      this.undoMgr.clear()
      this._pushUndo()
    }
    if (json.fabricJson) {
      // テンプレートJSONの場合
      return this.fabricCanvas.loadFromJSON(JSON.parse(json.fabricJson)).then(afterLoad)
    } else if (json.objects !== undefined) {
      // fabric JSONの場合
      return this.fabricCanvas.loadFromJSON(json).then(afterLoad)
    } else {
      // defaultGridのみのテンプレート
      this.clearCanvas()
      return Promise.resolve()
    }
  }

  clearCanvas() {
    this.fabricCanvas.clear()
    this.fabricCanvas.backgroundColor = this.gridConfig.bgColor
    this.drawGrid()
    this.fabricCanvas.renderAll()
    this.undoMgr.clear()
    this._pushUndo()
  }

  getGridConfig() {
    return Object.assign({}, this.gridConfig)
  }

  _setGridConfigInternal(newConfig) {
    Object.assign(this.gridConfig, newConfig)
    this.placer = new window.ElementPlacer(this.gridConfig)
    this.fabricCanvas.setWidth(this.gridConfig.canvasWidth)
    this.fabricCanvas.setHeight(this.gridConfig.canvasHeight)
    this.fabricCanvas.backgroundColor = this.gridConfig.bgColor
    this.drawGrid()
  }

  setGridConfig(newConfig) {
    this._setGridConfigInternal(newConfig)
    clearTimeout(this._undoDebounceTimer)
    this._undoDebounceTimer = setTimeout(() => this._pushUndo(), 500)
  }

  // レイヤー切替時にセルサイズ・オフセット・ギャップのみ更新（undo不要）
  applyLayerGridConfig(layerConfig) {
    if (layerConfig.cellSize !== undefined) this.gridConfig.cellSize = layerConfig.cellSize
    if (layerConfig.offsetX !== undefined) this.gridConfig.offsetX = layerConfig.offsetX
    if (layerConfig.offsetY !== undefined) this.gridConfig.offsetY = layerConfig.offsetY
    if (layerConfig.cellGapX !== undefined) this.gridConfig.cellGapX = layerConfig.cellGapX
    if (layerConfig.cellGapY !== undefined) this.gridConfig.cellGapY = layerConfig.cellGapY
    this.placer = new window.ElementPlacer(this.gridConfig)
    this.drawGrid()
  }

  cancelDebouncedUndo() {
    clearTimeout(this._undoDebounceTimer)
    this._undoDebounceTimer = null
  }

  _applySnapshot(snap) {
    const data = JSON.parse(snap)
    if (data._v === 2) {
      this._setGridConfigInternal(data.gridConfig)
      return this.fabricCanvas.loadFromJSON(data.fabricJson).then(() => {
        this.drawGrid()
        this.fabricCanvas.renderAll()
      })
    }
    // 旧形式 (v1: gridConfigなし)
    return this.fabricCanvas.loadFromJSON(data).then(() => {
      this.drawGrid()
      this.fabricCanvas.renderAll()
    })
  }

  undo() {
    const snap = this.undoMgr.undo()
    if (!snap) return
    return this._applySnapshot(snap)
  }

  redo() {
    const snap = this.undoMgr.redo()
    if (!snap) return
    return this._applySnapshot(snap)
  }
}

window.GridCanvas = GridCanvas
