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

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
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
    this._config = gridConfig;
  }

  /**
   * Canvas座標から最も近いグリッド境界セグメントを取得する
   * @param {number} x - Canvas X座標
   * @param {number} y - Canvas Y座標
   * @returns {Object|null} セグメント情報オブジェクト、またはnull
   */
  _getSegment(x, y) {
    const { cellSize, offsetX, offsetY } = this._config;
    const cols = Math.floor((this._config.canvasWidth - offsetX) / cellSize);
    const rows = Math.floor((this._config.canvasHeight - offsetY) / cellSize);
    const threshold = cellSize * 0.3;

    let nearest = null;
    let minDist = Infinity;

    // 水平境界のループ (r=0..rows, c=0..cols-1)
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x1 = offsetX + c * cellSize;
        const y1 = offsetY + r * cellSize;
        const x2 = offsetX + (c + 1) * cellSize;
        const id = `h-${r}-${c}`;

        const dist = this._distToSegment(x, y, x1, y1, x2, y1);
        if (dist < threshold && dist < minDist) {
          minDist = dist;
          nearest = { id, x1, y1, x2, y2: y1, type: 'horizontal' };
        }
      }
    }

    // 垂直境界のループ (r=0..rows-1, c=0..cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const x1 = offsetX + c * cellSize;
        const y1 = offsetY + r * cellSize;
        const y2 = offsetY + (r + 1) * cellSize;
        const id = `v-${r}-${c}`;

        const dist = this._distToSegment(x, y, x1, y1, x1, y2);
        if (dist < threshold && dist < minDist) {
          minDist = dist;
          nearest = { id, x1, y1, x2: x1, y2, type: 'vertical' };
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
    } else {
      const line = new fabric.Line([seg.x1, seg.y1, seg.x2, seg.y2], {
        stroke: '#000000',
        strokeWidth: 3,
        selectable: false,
        evented: false,
        data: { type: 'maze-line', segId: seg.id }
      });
      this._canvas.add(line);
      this._lines.set(seg.id, line);
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
        stroke: '#000000', strokeWidth: 3, selectable: false, evented: false,
        data: { type: 'maze-line', segId: seg.id }
      });
      this._canvas.add(line);
      this._lines.set(seg.id, line);
      this._canvas.renderAll();
    } else if (this._drawAction === 'remove' && this._lines.has(seg.id)) {
      this._canvas.remove(this._lines.get(seg.id));
      this._lines.delete(seg.id);
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
}

window.MazeDrawer = MazeDrawer;
