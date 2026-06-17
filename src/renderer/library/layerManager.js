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

  addLayer(name = null) {
    this._counter++;
    const id = 'layer-' + this._counter;
    const resolvedName = name || 'Layer ' + (this._layers.length + 1);
    const layer = { id, name: resolvedName, visible: true };
    this._layers.push(layer);
    return layer;
  }

  removeLayer(id) {
    if (this._layers.length <= 1) return false;

    for (const [obj, layerId] of this._objLayerMap) {
      if (layerId === id) {
        this._canvas.remove(obj);
        this._objLayerMap.delete(obj);
      }
    }

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
  }

  getLayers() {
    return [...this._layers];
  }
}

window.LayerManager = LayerManager;
