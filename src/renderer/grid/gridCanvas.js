/**
 * GridCanvas (UNT-001)
 * fabric.js v6 ベースのグリッドキャンバス管理クラス。
 * 依存: window.ElementPlacer, window.EditorUndoManager, window.ElementCatalog, グローバル fabric
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
        gridLineWidth: 1
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
    this.catalog = new window.ElementCatalog()
    this._gridLines = []
    this._gridVisible = true
    this.drawGrid()
    // 変更をundoスタックに記録
    this.fabricCanvas.on('object:modified', () => this._pushUndo())
    // 初期状態を記録
    this._pushUndo()
  }

  _pushUndo() {
    this.undoMgr.push(this.getSnapshot())
  }

  drawGrid() {
    // 既存グリッド線を削除
    this._gridLines.forEach(l => this.fabricCanvas.remove(l))
    this._gridLines = []
    const { cellSize, offsetX, offsetY, canvasWidth, canvasHeight, gridLineColor, gridLineWidth } = this.gridConfig
    const rows = Math.floor((canvasHeight - offsetY) / cellSize)
    const cols = Math.floor((canvasWidth - offsetX) / cellSize)
    const opacity = this._gridVisible ? 1 : 0
    const addLine = (x1, y1, x2, y2) => {
      const l = new fabric.Line([x1, y1, x2, y2], {
        stroke: gridLineColor,
        strokeWidth: gridLineWidth,
        selectable: false,
        evented: false,
        excludeFromExport: false,
        opacity: opacity,
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
    this.fabricCanvas.renderAll()
  }

  toggleGrid(visible) {
    this._gridVisible = visible
    this._gridLines.forEach(l => l.set('opacity', visible ? 1 : 0))
    this.fabricCanvas.renderAll()
  }

  getCellFromPoint(x, y) {
    const { cellSize, offsetX, offsetY } = this.gridConfig
    const col = Math.max(0, Math.floor((x - offsetX) / cellSize))
    const row = Math.max(0, Math.floor((y - offsetY) / cellSize))
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
    // グリッド線を除外したJSONを返す
    const json = this.fabricCanvas.toJSON(['data'])
    json.objects = (json.objects || []).filter(o => !(o.data && o.data.type === 'grid-line'))
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
      this.setGridConfig(configUpdate)
    }
    if (json.fabricJson) {
      // テンプレートJSONの場合
      this.fabricCanvas.loadFromJSON(JSON.parse(json.fabricJson)).then(() => {
        this.drawGrid()
        this.fabricCanvas.renderAll()
      })
    } else if (json.objects !== undefined) {
      // fabric JSONの場合
      this.fabricCanvas.loadFromJSON(json).then(() => {
        this.drawGrid()
        this.fabricCanvas.renderAll()
      })
    } else {
      // defaultGridのみのテンプレート
      this.clearCanvas()
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

  setGridConfig(newConfig) {
    Object.assign(this.gridConfig, newConfig)
    this.placer = new window.ElementPlacer(this.gridConfig)
    this.fabricCanvas.setWidth(this.gridConfig.canvasWidth)
    this.fabricCanvas.setHeight(this.gridConfig.canvasHeight)
    this.fabricCanvas.backgroundColor = this.gridConfig.bgColor
    this.drawGrid()
  }

  undo() {
    const snap = this.undoMgr.undo()
    if (!snap) return
    const json = JSON.parse(snap)
    this.fabricCanvas.loadFromJSON(json).then(() => {
      this.drawGrid()
      this.fabricCanvas.renderAll()
    })
  }

  redo() {
    const snap = this.undoMgr.redo()
    if (!snap) return
    const json = JSON.parse(snap)
    this.fabricCanvas.loadFromJSON(json).then(() => {
      this.drawGrid()
      this.fabricCanvas.renderAll()
    })
  }
}

window.GridCanvas = GridCanvas
