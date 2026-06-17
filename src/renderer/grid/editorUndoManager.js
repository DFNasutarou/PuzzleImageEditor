class EditorUndoManager {
  constructor(maxSize = 50) {
    this._stack = []   // string[] (fabric JSON snapshots)
    this._pointer = -1
    this._maxSize = maxSize
  }

  push(snapshot) {
    // pointerより後のhistoryを削除
    this._stack = this._stack.slice(0, this._pointer + 1)
    this._stack.push(snapshot)
    if (this._stack.length > this._maxSize) this._stack.shift()
    this._pointer = this._stack.length - 1
  }

  undo() { if (!this.canUndo()) return null; return this._stack[--this._pointer] }
  redo() { if (!this.canRedo()) return null; return this._stack[++this._pointer] }
  canUndo() { return this._pointer > 0 }
  canRedo() { return this._pointer < this._stack.length - 1 }
  clear() { this._stack = []; this._pointer = -1 }
}

window.EditorUndoManager = EditorUndoManager
