/**
 * CHG_005: レイヤー管理
 * LayerManager - Fabric.jsキャンバス上のレイヤーを管理するクラス
 */

class LayerManager {
  constructor(fabricCanvas) {
    this._canvas = fabricCanvas;
    this._layers = [];
    this._activeLayerId = null;
    this._objLayerMap = new Map();
    this._counter = 0;

    const defaultLayer = this.addLayer('Layer 1');
    this._activeLayerId = defaultLayer.id;
  }

  addLayer(name = null, gridConfig = {}) {
    this._counter++;
    const id = 'layer-' + this._counter;
    const resolvedName = name || 'Layer ' + (this._layers.length + 1);
    const layer = {
      id, name: resolvedName, visible: true, gridVisible: true,
      cellSize: gridConfig.cellSize !== undefined ? gridConfig.cellSize : 60,
      offsetX: gridConfig.offsetX !== undefined ? gridConfig.offsetX : 0,
      offsetY: gridConfig.offsetY !== undefined ? gridConfig.offsetY : 0,
      cellGapX: gridConfig.cellGapX !== undefined ? gridConfig.cellGapX : 0,
      cellGapY: gridConfig.cellGapY !== undefined ? gridConfig.cellGapY : 0
    };
    this._layers.push(layer);
    return layer;
  }

  setLayerGridConfig(id, config) {
    const layer = this._layers.find(l => l.id === id);
    if (!layer) return;
    if (config.cellSize !== undefined) layer.cellSize = config.cellSize;
    if (config.offsetX !== undefined) layer.offsetX = config.offsetX;
    if (config.offsetY !== undefined) layer.offsetY = config.offsetY;
    if (config.cellGapX !== undefined) layer.cellGapX = config.cellGapX;
    if (config.cellGapY !== undefined) layer.cellGapY = config.cellGapY;
  }

  getActiveLayerGridConfig() {
    const layer = this._layers.find(l => l.id === this._activeLayerId);
    if (!layer) return { cellSize: 60, offsetX: 0, offsetY: 0, cellGapX: 0, cellGapY: 0 };
    return {
      cellSize: layer.cellSize !== undefined ? layer.cellSize : 60,
      offsetX: layer.offsetX !== undefined ? layer.offsetX : 0,
      offsetY: layer.offsetY !== undefined ? layer.offsetY : 0,
      cellGapX: layer.cellGapX !== undefined ? layer.cellGapX : 0,
      cellGapY: layer.cellGapY !== undefined ? layer.cellGapY : 0
    };
  }

  setLayerGridVisible(id, visible) {
    const layer = this._layers.find(l => l.id === id);
    if (layer) layer.gridVisible = visible;
  }

  getActiveLayerGridVisible() {
    const layer = this._layers.find(l => l.id === this._activeLayerId);
    return layer ? layer.gridVisible !== false : true;
  }

  removeLayer(id) {
    if (this._layers.length <= 1) return false;

    // 削除対象を先に収集してからまとめて削除（イテレーション中の変更を避ける）
    const toRemove = []
    for (const [obj, layerId] of this._objLayerMap) {
      if (layerId === id) toRemove.push(obj)
    }
    toRemove.forEach(obj => {
      this._canvas.remove(obj)
      this._objLayerMap.delete(obj)
    })

    this._layers = this._layers.filter(layer => layer.id !== id);

    if (this._activeLayerId === id) {
      this._activeLayerId = this._layers[0].id;
    }

    this._canvas.renderAll();
    return true;
  }

  setActiveLayer(id) {
    this._activeLayerId = id;
  }

  // アクティブレイヤーのオブジェクトのみ選択可能にする
  syncLayerSelectability() {
    for (const [obj, layerId] of this._objLayerMap) {
      if (obj.data && obj.data.type === 'maze-line') continue
      const isActive = layerId === this._activeLayerId
      obj.set({ selectable: isActive, evented: isActive })
    }
  }

  getActiveLayerId() {
    return this._activeLayerId;
  }

  toggleLayerVisibility(id) {
    const layer = this._layers.find(l => l.id === id);
    if (!layer) return;

    layer.visible = !layer.visible;

    for (const [obj, layerId] of this._objLayerMap) {
      if (layerId === id) {
        obj.set('visible', layer.visible);
      }
    }

    this._canvas.renderAll();
  }

  registerObject(fabricObj) {
    this._objLayerMap.set(fabricObj, this._activeLayerId);
    // undo/redo後に復元できるようlayerIdをfabricオブジェクトのdataに記録する
    const prev = fabricObj.data || {};
    fabricObj.set('data', Object.assign({}, prev, { layerId: this._activeLayerId }));
  }

  unregisterObject(fabricObj) {
    this._objLayerMap.delete(fabricObj);
  }

  rebuildFromCanvas() {
    this._objLayerMap.clear();
    this._canvas.getObjects().forEach(obj => {
      const layerId = obj.data && obj.data.layerId;
      if (layerId && this._layers.some(l => l.id === layerId)) {
        this._objLayerMap.set(obj, layerId);
      }
    });
  }

  getLayers() {
    return [...this._layers];
  }

  reset() {
    this._objLayerMap.clear();
    this._layers = [];
    this._activeLayerId = null;
    this._counter = 0;
    const defaultLayer = this.addLayer('Layer 1');
    this._activeLayerId = defaultLayer.id;
  }
}

window.LayerManager = LayerManager;
