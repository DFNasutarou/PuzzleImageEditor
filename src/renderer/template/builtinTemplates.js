window.BUILTIN_TEMPLATES = [
  {
    id: 'word-grid',
    label: '文字グリッド',
    description: '文字を配置するための標準的なグリッドテンプレートです。',
    schemaVersion: '1.0',
    defaultGrid: {
      rows: 10,
      cols: 10,
      cellSize: 60,
      offsetX: 20,
      offsetY: 20,
      bgColor: '#ffffff',
      gridLineColor: '#cccccc',
      gridLineWidth: 1
    }
  },
  {
    id: 'number-cipher',
    label: '数字暗号',
    description: '数字を使った暗号パズル用のグリッドテンプレートです。',
    schemaVersion: '1.0',
    defaultGrid: {
      rows: 8,
      cols: 8,
      cellSize: 70,
      offsetX: 20,
      offsetY: 20,
      bgColor: '#ffffff',
      gridLineColor: '#cccccc',
      gridLineWidth: 1
    }
  },
  {
    id: 'shape-layout',
    label: '図形配置',
    description: '図形を配置するための横長グリッドテンプレートです。',
    schemaVersion: '1.0',
    defaultGrid: {
      rows: 8,
      cols: 12,
      cellSize: 80,
      offsetX: 20,
      offsetY: 20,
      bgColor: '#ffffff',
      gridLineColor: '#cccccc',
      gridLineWidth: 1
    }
  },
  {
    id: 'crossword',
    label: 'クロスワード',
    description: 'クロスワードパズル用の大きめグリッドテンプレートです。',
    schemaVersion: '1.0',
    defaultGrid: {
      rows: 15,
      cols: 15,
      cellSize: 45,
      offsetX: 20,
      offsetY: 20,
      bgColor: '#ffffff',
      gridLineColor: '#cccccc',
      gridLineWidth: 1
    }
  },
  {
    id: 'maze',
    label: '迷路',
    description: '迷路パズル用の細かいグリッドテンプレートです。壁が見やすい太めの線を使用します。',
    schemaVersion: '1.0',
    defaultGrid: {
      rows: 20,
      cols: 20,
      cellSize: 36,
      offsetX: 20,
      offsetY: 20,
      bgColor: '#ffffff',
      gridLineColor: '#000000',
      gridLineWidth: 2
    }
  }
];
