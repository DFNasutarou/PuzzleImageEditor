class ElementPlacer {
  constructor(gridConfig) {
    // gridConfig: {rows, cols, cellSize, offsetX, offsetY}
    this._config = gridConfig
  }

  cellToPixel({ row, col }) {
    const { cellSize, offsetX, offsetY } = this._config
    return {
      x: offsetX + col * cellSize,
      y: offsetY + row * cellSize
    }
  }

  cellCenter({ row, col }) {
    const { cellSize } = this._config
    const topLeft = this.cellToPixel({ row, col })
    return {
      x: topLeft.x + cellSize / 2,
      y: topLeft.y + cellSize / 2
    }
  }

  snapToGrid({ x, y }) {
    const { cellSize, offsetX, offsetY } = this._config
    const col = Math.round((x - offsetX) / cellSize)
    const row = Math.round((y - offsetY) / cellSize)
    return { row, col }
  }

  placeText(canvas, cellPos, options = {}) {
    const { fontFamily = 'sans-serif', fill = '#000000' } = options
    const { cellSize } = this._config
    const { x, y } = this.cellToPixel(cellPos)
    const fontSize = Math.floor(cellSize * 0.72)
    const char = (options.text || '').charAt(0) || ' '

    const obj = new fabric.Text(char, {
      left: x,
      top: y,
      width: cellSize,
      height: cellSize,
      fontSize,
      fontFamily,
      fill,
      textAlign: 'center',
      originX: 'left',
      originY: 'top',
      selectable: true
    })

    canvas.add(obj)
    canvas.renderAll()
    return obj
  }

  placeShape(canvas, cellPos, options = {}) {
    const {
      shapeName = 'rect',
      fill = '#4a90d9',
      stroke = '#000000',
      strokeWidth = 1,
      width,
      height
    } = options
    const { cellSize } = this._config
    const { x, y } = this.cellToPixel(cellPos)
    const w = width != null ? width : cellSize
    const h = height != null ? height : cellSize

    let obj

    switch (shapeName) {
      case 'rect':
        obj = new fabric.Rect({
          left: x,
          top: y,
          width: w,
          height: h,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break

      case 'circle': {
        const rx = w / 2
        const ry = h / 2
        obj = new fabric.Ellipse({
          left: x,
          top: y,
          rx,
          ry,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break
      }

      case 'triangle':
        obj = new fabric.Triangle({
          left: x,
          top: y,
          width: w,
          height: h,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break

      case 'star': {
        // 5-pointed star centered at (w/2, h/2), scaled to fit w x h
        const cx = w / 2
        const cy = h / 2
        const outerR = Math.min(w, h) / 2
        const innerR = outerR * 0.4
        const points = 5
        let d = ''
        for (let i = 0; i < points * 2; i++) {
          const angle = (Math.PI / points) * i - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          const px = cx + r * Math.cos(angle)
          const py = cy + r * Math.sin(angle)
          d += (i === 0 ? 'M' : 'L') + px + ',' + py
        }
        d += ' Z'
        obj = new fabric.Path(d, {
          left: x,
          top: y,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break
      }

      case 'arrow': {
        // Right-pointing arrow scaled to w x h
        const aw = w
        const ah = h
        const shaftH = ah * 0.4
        const shaftTop = (ah - shaftH) / 2
        const headW = aw * 0.35
        const d =
          `M 0,${shaftTop}` +
          ` L ${aw - headW},${shaftTop}` +
          ` L ${aw - headW},0` +
          ` L ${aw},${ah / 2}` +
          ` L ${aw - headW},${ah}` +
          ` L ${aw - headW},${shaftTop + shaftH}` +
          ` L 0,${shaftTop + shaftH}` +
          ' Z'
        obj = new fabric.Path(d, {
          left: x,
          top: y,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break
      }

      case 'diamond': {
        const dw = w
        const dh = h
        const d =
          `M ${dw / 2},0` +
          ` L ${dw},${dh / 2}` +
          ` L ${dw / 2},${dh}` +
          ` L 0,${dh / 2}` +
          ' Z'
        obj = new fabric.Path(d, {
          left: x,
          top: y,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break
      }

      case 'hexagon': {
        // Flat-top hexagon scaled to w x h
        const hw = w
        const hh = h
        const d =
          `M ${hw * 0.25},0` +
          ` L ${hw * 0.75},0` +
          ` L ${hw},${hh / 2}` +
          ` L ${hw * 0.75},${hh}` +
          ` L ${hw * 0.25},${hh}` +
          ` L 0,${hh / 2}` +
          ' Z'
        obj = new fabric.Path(d, {
          left: x,
          top: y,
          fill,
          stroke,
          strokeWidth,
          selectable: true
        })
        break
      }

      default:
        throw new Error(`ElementPlacer.placeShape: unknown shapeName "${shapeName}"`)
    }

    canvas.add(obj)
    canvas.renderAll()
    return obj
  }

  placeImage(canvas, cellPos, options = {}) {
    const { src = '', opacity = 1 } = options
    const { cellSize } = this._config
    const { x, y } = this.cellToPixel(cellPos)

    return fabric.Image.fromURL(src).then(img => {
      const scaleX = cellSize / img.width
      const scaleY = cellSize / img.height
      img.set({ left: x, top: y, scaleX, scaleY, opacity, selectable: true })
      canvas.add(img)
      canvas.renderAll()
      return img
    })
  }
}

window.ElementPlacer = ElementPlacer
