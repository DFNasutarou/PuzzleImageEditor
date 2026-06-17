/**
 * SvgExporter (UNT-007)
 * fabric.js Canvas の内容を SVG 文字列としてエクスポートする。
 * 依存: グローバル fabric
 */
class SvgExporter {
  /**
   * @param {object} gridCanvas - fabricCanvas プロパティを持つラッパーオブジェクト
   * @param {boolean} embedImages - 将来の拡張用フラグ (現在は未使用)
   * @returns {Promise<string>} SVG 文字列
   */
  async exportSvg(gridCanvas, embedImages = true) {
    return new Promise((resolve, reject) => {
      try {
        const svgStr = gridCanvas.fabricCanvas.toSVG()
        resolve(svgStr)
      } catch (e) {
        reject(e)
      }
    })
  }
}

window.SvgExporter = SvgExporter
