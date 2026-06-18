'use strict';

/**
 * MazeDrawer - CHG_006対応: 迷路線引きモード
 * グリッドのセル境界線をクリック/ドラッグでトグル描画するクラス
 */
class MazeDrawer {
  /**
   * @param {fabric.Canvas} fabricCanvas - Fabric.jsのCanvasインスタンス
   * @param {Object} gridConfig - グリッド設定オブジェクト
   */
  constructor(fabricCanvas, gridConfig) {
    this._canvas = fabricCanvas;
    this._config = gridConfig;
    this._enabled = false;
    this._lines = new Map();
    this._isDrawing = false;
    this._drawAction = null;
    this._lastSegId = null;
    this._layerManager = null;
    this._strokeColor = '#000000';
    this._strokeWidth = 3;

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
  }

  setLayerManager(layerManager) {
    this._layerManager = layerManager;
  }

  setStyle(color, width) {
    this._strokeColor = color || '#000000';
    this._strokeWidth = Math.max(1, parseInt(width) || 3);
  }

  /**
   * 迷路線引きモードを有効化する
   */
  enable() {
    this._enabled = true;
    this._canvas.on('mouse:down', this._onMouseDown);
    this._canvas.on('mouse:move', this._onMouseMove);
    this._canvas.on('mouse:up', this._onMouseUp);
  }

  /**
   * 迷路線引きモードを無効化する
   */
  disable() {
    this._enabled = false;
    this._isDrawing = false;
    this._canvas.off('mouse:down', this._onMouseDown);
    this._canvas.off('mouse:move', this._onMouseMove);
    this._canvas.off('mouse:up', this._onMouseUp);
  }

  /**
   * グリッド設定を更新する
   * @param {Object} gridConfig - 新しいグリッド設定オブジェクト
   */
  updateConfig(gridConfig) {
    const oldGapX = this._config.cellGapX || 0;
    const oldGapY = this._config.cellGapY || 0;
    this._config = gridConfig;
    if (this._lines.size > 0) {
      this._repositionLines(oldGapX, oldGapY);
    }
  }

  _repositionLines(oldGapX, oldGapY) {
    const { cellSize, offsetX, offsetY, cellGapX = 0, cellGapY = 0, canvasWidth, canvasHeight } = this._config;
    const stepX = cellSize + cellGapX;
    const stepY = cellSize + cellGapY;
    const cols = Math.floor((canvasWidth - offsetX) / stepX);
    const rows = Math.floor((canvasHeight - offsetY) / stepY);

    // X/Y方向それぞれ独立してモード変化を検出
    const xChanged = (oldGapX === 0) !== (cellGapX === 0);
    const yChanged = (oldGapY === 0) !== (cellGapY === 0);

    const newLines = new Map();

    this._lines.forEach((line, segId) => {
      const parts = segId.split('-');
      const kind = parts[0];
      const r = parseInt(parts[1]);
      const c = parseInt(parts[2]);
      let newId = null;

      if (kind === 'h') {
        // 水平境界 (cellGapY=0モード)
        // Y変化(0→正): h-r-c → top-r-c（上の行境界 = セル上辺）
        if (yChanged) {
          if (r < rows && c < cols) newId = `top-${r}-${c}`;
        } else {
          if (r <= rows && c < cols) newId = `h-${r}-${c}`;
        }
      } else if (kind === 'v') {
        // 垂直境界 (cellGapX=0モード)
        // X変化(0→正): v-r-c → left-r-c（左の列境界 = セル左辺）
        if (xChanged) {
          if (r < rows && c < cols) newId = `left-${r}-${c}`;
        } else {
          if (r < rows && c <= cols) newId = `v-${r}-${c}`;
        }
      } else if (kind === 'top') {
        // Y変化(正→0): top-r-c → h-r-c
        if (yChanged) {
          if (r <= rows && c < cols) newId = `h-${r}-${c}`;
        } else {
          if (r < rows && c < cols) newId = `top-${r}-${c}`;
        }
      } else if (kind === 'bottom') {
        // Y変化(正→0): bottom-r-c → h-(r+1)-c
        if (yChanged) {
          const nr = r + 1;
          if (nr <= rows && c < cols) newId = `h-${nr}-${c}`;
        } else {
          if (r < rows && c < cols) newId = `bottom-${r}-${c}`;
        }
      } else if (kind === 'left') {
        // X変化(正→0): left-r-c → v-r-c
        if (xChanged) {
          if (r < rows && c <= cols) newId = `v-${r}-${c}`;
        } else {
          if (r < rows && c < cols) newId = `left-${r}-${c}`;
        }
      } else if (kind === 'right') {
        // X変化(正→0): right-r-c → v-r-(c+1)
        if (xChanged) {
          const nc = c + 1;
          if (r < rows && nc <= cols) newId = `v-${r}-${nc}`;
        } else {
          if (r < rows && c < cols) newId = `right-${r}-${c}`;
        }
      }

      if (!newId) {
        this._canvas.remove(line);
        if (this._layerManager) this._layerManager.unregisterObject(line);
      } else if (newLines.has(newId)) {
        // top/bottom が同じ h-*-* にマップされた等の重複は2本目を削除
        this._canvas.remove(line);
        if (this._layerManager) this._layerManager.unregisterObject(line);
      } else {
        const coords = this._coordsFromId(newId, rows, cols, offsetX, offsetY, cellSize, stepX, stepY);
        if (coords) {
          line.set({ x1: coords.x1, y1: coords.y1, x2: coords.x2, y2: coords.y2 });
          line.setCoords();
          newLines.set(newId, line);
        } else {
          this._canvas.remove(line);
          if (this._layerManager) this._layerManager.unregisterObject(line);
        }
      }
    });

    this._lines = newLines;
    this._canvas.renderAll();
  }

  _coordsFromId(segId, rows, cols, offsetX, offsetY, cellSize, stepX, stepY) {
    const parts = segId.split('-');
    const kind = parts[0];

    if (kind === 'h') {
      // 水平境界: cellGapY=0前提なのでstepY=cellSize
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r > rows || c >= cols) return null;
      const sy = offsetY + r * cellSize;
      return { x1: offsetX + c * stepX, y1: sy, x2: offsetX + c * stepX + cellSize, y2: sy };

    } else if (kind === 'v') {
      // 垂直境界: cellGapX=0前提なのでstepX=cellSize
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r >= rows || c > cols) return null;
      const sx = offsetX + c * cellSize;
      return { x1: sx, y1: offsetY + r * stepY, x2: sx, y2: offsetY + r * stepY + cellSize };

    } else if (kind === 'top') {
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r >= rows || c >= cols) return null;
      const L = offsetX + c * stepX, T = offsetY + r * stepY;
      return { x1: L, y1: T, x2: L + cellSize, y2: T };

    } else if (kind === 'bottom') {
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r >= rows || c >= cols) return null;
      const L = offsetX + c * stepX, B = offsetY + r * stepY + cellSize;
      return { x1: L, y1: B, x2: L + cellSize, y2: B };

    } else if (kind === 'left') {
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r >= rows || c >= cols) return null;
      const L = offsetX + c * stepX, T = offsetY + r * stepY;
      return { x1: L, y1: T, x2: L, y2: T + cellSize };

    } else if (kind === 'right') {
      const r = parseInt(parts[1]), c = parseInt(parts[2]);
      if (r >= rows || c >= cols) return null;
      const R = offsetX + c * stepX + cellSize, T = offsetY + r * stepY;
      return { x1: R, y1: T, x2: R, y2: T + cellSize };
    }

    return null;
  }

  /**
   * Canvas座標から最も近いグリッド境界セグメントを取得する
   * @param {number} x - Canvas X座標
   * @param {number} y - Canvas Y座標
   * @returns {Object|null} セグメント情報オブジェクト、またはnull
   */
  _getSegment(x, y) {
    const { cellSize, offsetX, offsetY, cellGapX = 0, cellGapY = 0 } = this._config;
    const stepX = cellSize + cellGapX;
    const stepY = cellSize + cellGapY;
    const cols = Math.floor((this._config.canvasWidth - offsetX) / stepX);
    const rows = Math.floor((this._config.canvasHeight - offsetY) / stepY);

    let nearest = null;
    let minDist = Infinity;

    // ── 水平方向: cellGapY=0 → 境界線 h-r-c、cellGapY>0 → セル辺 top/bottom ──
    if (cellGapY === 0) {
      const thresh = cellSize * 0.3;
      for (let r = 0; r <= rows; r++) {
        const sy = offsetY + r * cellSize;
        for (let c = 0; c < cols; c++) {
          const x1 = offsetX + c * stepX;
          const x2 = x1 + cellSize;
          const dist = this._distToSegment(x, y, x1, sy, x2, sy);
          if (dist < thresh && dist < minDist) {
            minDist = dist;
            nearest = { id: `h-${r}-${c}`, x1, y1: sy, x2, y2: sy };
          }
        }
      }
    } else {
      const hitOuter = Math.max(cellGapY / 2, 4);
      const hitInner = Math.min(cellSize * 0.35, 16);
      for (let r = 0; r < rows; r++) {
        const T = offsetY + r * stepY;
        const B = T + cellSize;
        for (let c = 0; c < cols; c++) {
          const L = offsetX + c * stepX;
          const R = L + cellSize;
          if (x < L - 4 || x > R + 4) continue;
          if (y < T - hitOuter || y > B + hitOuter) continue;
          const dT = this._distToSegment(x, y, L, T, R, T);
          if (dT < (y <= T ? hitOuter : hitInner) && dT < minDist) {
            minDist = dT; nearest = { id: `top-${r}-${c}`, x1: L, y1: T, x2: R, y2: T };
          }
          const dB = this._distToSegment(x, y, L, B, R, B);
          if (dB < (y >= B ? hitOuter : hitInner) && dB < minDist) {
            minDist = dB; nearest = { id: `bottom-${r}-${c}`, x1: L, y1: B, x2: R, y2: B };
          }
        }
      }
    }

    // ── 垂直方向: cellGapX=0 → 境界線 v-r-c、cellGapX>0 → セル辺 left/right ──
    if (cellGapX === 0) {
      const thresh = cellSize * 0.3;
      for (let r = 0; r < rows; r++) {
        const y1 = offsetY + r * stepY;
        const y2 = y1 + cellSize;
        for (let c = 0; c <= cols; c++) {
          const sx = offsetX + c * cellSize;
          const dist = this._distToSegment(x, y, sx, y1, sx, y2);
          if (dist < thresh && dist < minDist) {
            minDist = dist;
            nearest = { id: `v-${r}-${c}`, x1: sx, y1, x2: sx, y2 };
          }
        }
      }
    } else {
      const hitOuter = Math.max(cellGapX / 2, 4);
      const hitInner = Math.min(cellSize * 0.35, 16);
      for (let r = 0; r < rows; r++) {
        const T = offsetY + r * stepY;
        const B = T + cellSize;
        for (let c = 0; c < cols; c++) {
          const L = offsetX + c * stepX;
          const R = L + cellSize;
          if (y < T - 4 || y > B + 4) continue;
          if (x < L - hitOuter || x > R + hitOuter) continue;
          const dL = this._distToSegment(x, y, L, T, L, B);
          if (dL < (x <= L ? hitOuter : hitInner) && dL < minDist) {
            minDist = dL; nearest = { id: `left-${r}-${c}`, x1: L, y1: T, x2: L, y2: B };
          }
          const dR = this._distToSegment(x, y, R, T, R, B);
          if (dR < (x >= R ? hitOuter : hitInner) && dR < minDist) {
            minDist = dR; nearest = { id: `right-${r}-${c}`, x1: R, y1: T, x2: R, y2: B };
          }
        }
      }
    }

    return nearest;
  }

  /**
   * 点(px, py)から線分(x1,y1)-(x2,y2)への距離を計算する
   * @param {number} px - 点のX座標
   * @param {number} py - 点のY座標
   * @param {number} x1 - 線分始点X
   * @param {number} y1 - 線分始点Y
   * @param {number} x2 - 線分終点X
   * @param {number} y2 - 線分終点Y
   * @returns {number} 距離
   */
  _distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return Math.hypot(px - x1, py - y1);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const nearX = x1 + t * dx;
    const nearY = y1 + t * dy;

    return Math.hypot(px - nearX, py - nearY);
  }

  /**
   * 指定セグメントの線をトグル（追加/削除）する
   * @param {Object|null} seg - セグメント情報オブジェクト
   */
  _toggleLine(seg) {
    if (seg === null) return;

    if (this._lines.has(seg.id)) {
      const line = this._lines.get(seg.id);
      this._canvas.remove(line);
      this._lines.delete(seg.id);
      if (this._layerManager) this._layerManager.unregisterObject(line);
    } else {
      const line = new fabric.Line([seg.x1, seg.y1, seg.x2, seg.y2], {
        stroke: this._strokeColor,
        strokeWidth: this._strokeWidth,
        selectable: false,
        evented: false,
        data: { type: 'maze-line', segId: seg.id }
      });
      this._canvas.add(line);
      this._lines.set(seg.id, line);
      if (this._layerManager) this._layerManager.registerObject(line);
    }

    this._canvas.renderAll();
  }

  /**
   * mouse:downイベントハンドラ
   * @param {Object} e - Fabric.jsイベントオブジェクト
   */
  _handleMouseDown(e) {
    if (!this._enabled) return;
    this._isDrawing = true;
    const pointer = this._canvas.getPointer(e.e);
    const seg = this._getSegment(pointer.x, pointer.y);
    if (seg) {
      this._drawAction = this._lines.has(seg.id) ? 'remove' : 'add';
      this._lastSegId = seg.id;
      this._toggleLine(seg);
    }
  }

  /**
   * mouse:moveイベントハンドラ
   * @param {Object} e - Fabric.jsイベントオブジェクト
   */
  _handleMouseMove(e) {
    if (!this._enabled || !this._isDrawing || !this._drawAction) return;
    const pointer = this._canvas.getPointer(e.e);
    const seg = this._getSegment(pointer.x, pointer.y);
    if (!seg || seg.id === this._lastSegId) return;
    this._lastSegId = seg.id;
    if (this._drawAction === 'add' && !this._lines.has(seg.id)) {
      const line = new fabric.Line([seg.x1, seg.y1, seg.x2, seg.y2], {
        stroke: this._strokeColor, strokeWidth: this._strokeWidth,
        selectable: false, evented: false,
        data: { type: 'maze-line', segId: seg.id }
      });
      this._canvas.add(line);
      this._lines.set(seg.id, line);
      if (this._layerManager) this._layerManager.registerObject(line);
      this._canvas.renderAll();
    } else if (this._drawAction === 'remove' && this._lines.has(seg.id)) {
      const line = this._lines.get(seg.id);
      this._canvas.remove(line);
      this._lines.delete(seg.id);
      if (this._layerManager) this._layerManager.unregisterObject(line);
      this._canvas.renderAll();
    }
  }

  /**
   * mouse:upイベントハンドラ
   * @param {Object} e - Fabric.jsイベントオブジェクト
   */
  _handleMouseUp(e) {
    this._isDrawing = false;
    this._drawAction = null;
    this._lastSegId = null;
  }

  // undo/redo後にfabric canvas上のmaze-lineから_lines Mapを再構築する
  rebuildLines() {
    this._lines.clear();
    this._canvas.getObjects().forEach(obj => {
      if (obj.data && obj.data.type === 'maze-line' && obj.data.segId) {
        this._lines.set(obj.data.segId, obj);
      }
    });
  }
}

window.MazeDrawer = MazeDrawer;
