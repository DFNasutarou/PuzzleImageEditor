class TimeoutError extends Error {
  constructor() { super('PNG出力がタイムアウトしました（10秒）'); this.name = 'TimeoutError' }
}

class PngExporter {
  async exportPng(gridCanvas, dpi) {
    const scale = dpi / 96
    const exportPromise = new Promise((resolve, reject) => {
      try {
        const json = gridCanvas.getSnapshot()
        const cfg = gridCanvas.getGridConfig()
        const W = cfg.canvasWidth * scale
        const H = cfg.canvasHeight * scale
        // オフスクリーンcanvas要素を作成
        const el = document.createElement('canvas')
        el.width = W; el.height = H
        const offscreen = new fabric.Canvas(el, { width: W, height: H })
        offscreen.loadFromJSON(JSON.parse(json)).then(() => {
          offscreen.setZoom(scale)
          offscreen.setWidth(W); offscreen.setHeight(H)
          offscreen.renderAll()
          const dataURL = offscreen.toDataURL({ format: 'png', multiplier: 1 })
          offscreen.dispose()
          resolve(this._dataURLtoBlob(dataURL))
        })
      } catch (e) { reject(e) }
    })
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new TimeoutError()), 10000))
    return Promise.race([exportPromise, timeoutPromise])
  }

  _dataURLtoBlob(dataURL) {
    const [header, data] = dataURL.split(',')
    const mime = header.match(/:(.*?);/)[1]
    const binary = atob(data)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
    return new Blob([arr], { type: mime })
  }
}

window.PngExporter = PngExporter
window.TimeoutError = TimeoutError
