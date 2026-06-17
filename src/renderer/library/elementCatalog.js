class ElementCatalog {
  constructor() {
    this._data = {
      font: [
        {id:'f01', name:'セリフ', fontFamily:'Georgia'},
        {id:'f02', name:'サンセリフ', fontFamily:'Arial'},
        {id:'f03', name:'等幅', fontFamily:'Courier New'},
        {id:'f04', name:'筆記体', fontFamily:'cursive'},
        {id:'f05', name:'装飾', fontFamily:'fantasy'},
        {id:'f06', name:'Verdana', fontFamily:'Verdana'},
        {id:'f07', name:'Times New Roman', fontFamily:'Times New Roman'},
        {id:'f08', name:'Impact', fontFamily:'Impact'},
        {id:'f09', name:'Comic Sans', fontFamily:'Comic Sans MS'},
        {id:'f10', name:'Trebuchet', fontFamily:'Trebuchet MS'},
      ],
      shape: [
        {id:'s01', name:'矩形', shapeName:'rect', defaultFill:'#4a90d9', defaultStroke:'#2c5f8a'},
        {id:'s02', name:'円', shapeName:'circle', defaultFill:'#e74c3c', defaultStroke:'#922b21'},
        {id:'s03', name:'三角形', shapeName:'triangle', defaultFill:'#2ecc71', defaultStroke:'#1a8a4a'},
        {id:'s04', name:'星形', shapeName:'star', defaultFill:'#f39c12', defaultStroke:'#b7770d'},
        {id:'s05', name:'矢印', shapeName:'arrow', defaultFill:'#9b59b6', defaultStroke:'#6c3483'},
        {id:'s06', name:'ひし形', shapeName:'diamond', defaultFill:'#1abc9c', defaultStroke:'#0e8a74'},
        {id:'s07', name:'六角形', shapeName:'hexagon', defaultFill:'#e67e22', defaultStroke:'#a04000'},
      ],
      icon: []
    }
  }

  getElements(category) {
    return this._data[category] || []
  }

  addElement(def) {
    if (!this._data[def.category]) this._data[def.category] = []
    this._data[def.category].push(def)
  }
}

window.ElementCatalog = ElementCatalog
