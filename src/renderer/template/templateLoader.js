'use strict';

class TemplateNotFoundError extends Error {
  constructor(id) {
    super('テンプレートが見つかりません: ' + id);
    this.name = 'TemplateNotFoundError';
  }
}

class TemplateValidationError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'TemplateValidationError';
  }
}

class TemplateLoader {
  /**
   * テンプレートを読み込む
   * @param {string} idOrPath - 'builtin:<id>' 形式または外部JSONファイルパス
   * @returns {Promise<Object>} テンプレート定義オブジェクト
   */
  async loadTemplate(idOrPath) {
    if (idOrPath.startsWith('builtin:')) {
      const id = idOrPath.replace('builtin:', '');
      const tmpl = this.findBuiltin(id);
      if (!tmpl) throw new TemplateNotFoundError(idOrPath);
      this.validateSchema(tmpl);
      return tmpl;
    } else {
      // ファイルパスから読み込み
      const result = await window.electronAPI.readFile(idOrPath);
      if (result.error) throw new TemplateNotFoundError(idOrPath);
      const def = JSON.parse(result.data);
      this.validateSchema(def);
      return def;
    }
  }

  /**
   * テンプレート定義のスキーマを検証する
   * @param {Object} def - テンプレート定義オブジェクト
   * @throws {TemplateValidationError}
   */
  validateSchema(def) {
    if (!def.schemaVersion) throw new TemplateValidationError('schemaVersionが必要です');
    if (!def.defaultGrid) throw new TemplateValidationError('defaultGridが必要です');
    const g = def.defaultGrid;
    if (!g.rows || !g.cols || !g.cellSize) throw new TemplateValidationError('defaultGrid.rows/cols/cellSizeが必要です');
  }

  /**
   * 組み込みテンプレートをIDで検索する
   * @param {string} id - テンプレートID
   * @returns {Object|null}
   */
  findBuiltin(id) {
    return (window.BUILTIN_TEMPLATES || []).find(t => t.id === id) || null;
  }
}

window.TemplateLoader = TemplateLoader;
window.TemplateNotFoundError = TemplateNotFoundError;
window.TemplateValidationError = TemplateValidationError;
