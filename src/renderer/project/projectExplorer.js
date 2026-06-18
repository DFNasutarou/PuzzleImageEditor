'use strict'

class ProjectExplorer {
  constructor() {
    this._folderPath = null
    this._tree = []
    this._currentFile = null
    this._expandedFolders = new Set()
    this._onFileSelect = null
    this._showToast = null
    this._container = null
    this._treeEl = null
    this._contextMenu = null
  }

  init(containerEl, onFileSelect, showToast) {
    this._container = containerEl
    this._onFileSelect = onFileSelect
    this._showToast = showToast || function() {}
    this._buildUI()

    if (window.electronAPI.onFolderChanged) {
      window.electronAPI.onFolderChanged(() => this.refresh())
    }

    const lastFolder = localStorage.getItem('lastProjectFolder')
    if (lastFolder) {
      this.openFolder(lastFolder)
    }
  }

  async openFolder(folderPath) {
    this._folderPath = folderPath
    localStorage.setItem('lastProjectFolder', folderPath)
    try { await window.electronAPI.watchFolder(folderPath) } catch (_) {}
    await this.refresh()
    this._updateHeader()
  }

  async refresh() {
    if (!this._folderPath) return
    const result = await window.electronAPI.readDir(this._folderPath)
    if (result.error) {
      this._treeEl.innerHTML = '<div class="exp-empty">フォルダが見つかりません</div>'
      return
    }
    this._tree = result.items
    this._renderTree()
  }

  setCurrentFile(filePath) {
    this._currentFile = filePath
    if (!this._treeEl) return
    this._treeEl.querySelectorAll('.exp-file').forEach(function(el) {
      el.classList.toggle('exp-active', el.dataset.path === filePath)
    })
  }

  // ─── UI構築 ──────────────────────────────────────────────────────────────────

  _buildUI() {
    this._container.innerHTML = ''

    var header = document.createElement('div')
    header.id = 'exp-header'
    header.innerHTML =
      '<span id="exp-section-label">エクスプローラー</span>' +
      '<div id="exp-actions">' +
        '<button class="exp-action-btn" id="exp-new-file-btn" title="新規ファイル">＋📄</button>' +
        '<button class="exp-action-btn" id="exp-new-folder-btn" title="新規フォルダ">＋📁</button>' +
        '<button class="exp-action-btn" id="exp-open-btn" title="フォルダを開く">📂</button>' +
      '</div>'
    this._container.appendChild(header)

    var folderBar = document.createElement('div')
    folderBar.id = 'exp-folder-bar'
    folderBar.innerHTML = '<span id="exp-folder-name">フォルダを開いてください</span>'
    this._container.appendChild(folderBar)

    this._treeEl = document.createElement('div')
    this._treeEl.id = 'exp-tree'
    this._container.appendChild(this._treeEl)

    var self = this
    header.querySelector('#exp-open-btn').addEventListener('click', function() { self._openFolderDialog() })
    header.querySelector('#exp-new-file-btn').addEventListener('click', function() {
      if (self._folderPath) self._addInlineInput(self._folderPath, self._treeEl, 0, false)
    })
    header.querySelector('#exp-new-folder-btn').addEventListener('click', function() {
      if (self._folderPath) self._addInlineInput(self._folderPath, self._treeEl, 0, true)
    })

    document.addEventListener('click', function() { self._hideContextMenu() })
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') self._hideContextMenu()
    })

    this._treeEl.addEventListener('contextmenu', function(e) {
      if (e.target === self._treeEl && self._folderPath) {
        e.preventDefault()
        self._showContextMenu(e.clientX, e.clientY, { type: 'root' })
      }
    })
  }

  async _openFolderDialog() {
    var result = await window.electronAPI.openFolderDialog()
    if (result && result.folderPath) {
      this.openFolder(result.folderPath)
    }
  }

  _updateHeader() {
    var nameEl = document.getElementById('exp-folder-name')
    if (nameEl && this._folderPath) {
      var name = this._folderPath.replace(/\\/g, '/').split('/').pop()
      nameEl.textContent = name
      nameEl.title = this._folderPath
    }
  }

  // ─── ツリー描画 ──────────────────────────────────────────────────────────────

  _renderTree() {
    this._treeEl.innerHTML = ''
    if (!this._tree || this._tree.length === 0) {
      this._treeEl.innerHTML = '<div class="exp-empty">JSONファイルがありません</div>'
      return
    }
    this._renderItems(this._tree, this._treeEl, 0)
  }

  _renderItems(items, parentEl, depth) {
    var self = this
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      if (item.isDir) {
        self._renderFolder(item, parentEl, depth)
      } else {
        self._renderFile(item, parentEl, depth)
      }
    }
  }

  _renderFolder(item, parentEl, depth) {
    var self = this
    var isExpanded = this._expandedFolders.has(item.path)
    var indent = depth * 14

    var el = document.createElement('div')
    el.className = 'exp-folder'
    el.dataset.path = item.path
    el.innerHTML =
      '<span class="exp-indent" style="width:' + indent + 'px"></span>' +
      '<span class="exp-arrow">' + (isExpanded ? '▾' : '▸') + '</span>' +
      '<span class="exp-icon">📁</span>' +
      '<span class="exp-name">' + this._esc(item.name) + '</span>'

    el.addEventListener('click', function(e) {
      e.stopPropagation()
      self._toggleFolder(item.path)
    })
    el.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation()
      self._showContextMenu(e.clientX, e.clientY, { type: 'folder', path: item.path, name: item.name, el: el, item: item })
    })
    el.addEventListener('dblclick', function(e) {
      e.stopPropagation()
      self._startRename(el, item.path, true)
    })
    parentEl.appendChild(el)

    if (isExpanded) {
      var childEl = document.createElement('div')
      childEl.className = 'exp-children'
      childEl.dataset.parentPath = item.path
      if (item.children && item.children.length > 0) {
        this._renderItems(item.children, childEl, depth + 1)
      } else {
        childEl.innerHTML = '<div class="exp-empty" style="padding-left:' + ((depth + 1) * 14 + 28) + 'px">（空）</div>'
      }
      parentEl.appendChild(childEl)
    }
  }

  _renderFile(item, parentEl, depth) {
    var self = this
    var indent = depth * 14
    var el = document.createElement('div')
    el.className = 'exp-file' + (item.path === this._currentFile ? ' exp-active' : '')
    el.dataset.path = item.path
    el.innerHTML =
      '<span class="exp-indent" style="width:' + indent + 'px"></span>' +
      '<span class="exp-icon">📄</span>' +
      '<span class="exp-name">' + this._esc(item.name) + '</span>'

    el.addEventListener('click', function(e) {
      e.stopPropagation()
      if (self._onFileSelect) self._onFileSelect(item.path)
    })
    el.addEventListener('contextmenu', function(e) {
      e.preventDefault(); e.stopPropagation()
      self._showContextMenu(e.clientX, e.clientY, { type: 'file', path: item.path, name: item.name, el: el })
    })
    el.addEventListener('dblclick', function(e) {
      e.stopPropagation()
      self._startRename(el, item.path, false)
    })
    parentEl.appendChild(el)
  }

  _toggleFolder(folderPath) {
    if (this._expandedFolders.has(folderPath)) {
      this._expandedFolders.delete(folderPath)
    } else {
      this._expandedFolders.add(folderPath)
    }
    this._renderTree()
  }

  // ─── コンテキストメニュー ─────────────────────────────────────────────────────

  _showContextMenu(x, y, target) {
    this._hideContextMenu()
    var self = this
    var menu = document.createElement('div')
    menu.className = 'exp-context-menu'

    function addItem(label, action, danger) {
      var item = document.createElement('div')
      item.className = 'exp-ctx-item' + (danger ? ' danger' : '')
      item.textContent = label
      item.addEventListener('click', function(e) {
        e.stopPropagation()
        self._hideContextMenu()
        action()
      })
      menu.appendChild(item)
    }

    if (target.type === 'file') {
      addItem('開く', function() {
        if (self._onFileSelect) self._onFileSelect(target.path)
      })
      addItem('名前を変更', function() { self._startRename(target.el, target.path, false) })
      addItem('削除', function() { self._deleteItem(target.path, false) }, true)
    } else if (target.type === 'folder') {
      addItem('新規ファイル', function() {
        self._expandedFolders.add(target.path)
        self._renderTree()
        requestAnimationFrame(function() {
          var childEl = Array.from(self._treeEl.querySelectorAll('.exp-children'))
            .find(function(el) { return el.dataset.parentPath === target.path })
          if (childEl) {
            var depth = self._getDepth(target.path) + 1
            self._addInlineInput(target.path, childEl, depth, false)
          }
        })
      })
      addItem('新規フォルダ', function() {
        self._expandedFolders.add(target.path)
        self._renderTree()
        requestAnimationFrame(function() {
          var childEl = Array.from(self._treeEl.querySelectorAll('.exp-children'))
            .find(function(el) { return el.dataset.parentPath === target.path })
          if (childEl) {
            var depth = self._getDepth(target.path) + 1
            self._addInlineInput(target.path, childEl, depth, true)
          }
        })
      })
      addItem('名前を変更', function() { self._startRename(target.el, target.path, true) })
      addItem('削除（空のとき）', function() { self._deleteItem(target.path, true) }, true)
    } else if (target.type === 'root') {
      addItem('新規ファイル', function() { self._addInlineInput(self._folderPath, self._treeEl, 0, false) })
      addItem('新規フォルダ', function() { self._addInlineInput(self._folderPath, self._treeEl, 0, true) })
    }

    document.body.appendChild(menu)
    this._contextMenu = menu

    var rect = menu.getBoundingClientRect()
    var left = x, top = y
    if (left + rect.width > window.innerWidth) left = x - rect.width
    if (top + rect.height > window.innerHeight) top = y - rect.height
    menu.style.left = left + 'px'
    menu.style.top = top + 'px'
  }

  _hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove()
      this._contextMenu = null
    }
  }

  // ─── インラインリネーム ───────────────────────────────────────────────────────

  _startRename(itemEl, oldPath, isDir) {
    var self = this
    var nameEl = itemEl.querySelector('.exp-name')
    if (!nameEl) return
    var oldName = nameEl.textContent
    var input = document.createElement('input')
    input.type = 'text'
    input.value = oldName
    input.className = 'exp-inline-input'
    nameEl.replaceWith(input)
    input.focus()
    input.select()

    var committed = false
    var commit = async function() {
      if (committed) return
      committed = true
      var newName = input.value.trim()
      if (!newName || newName === oldName) { input.replaceWith(nameEl); return }
      var finalName = (!isDir && !newName.endsWith('.json')) ? newName + '.json' : newName
      var result = await window.electronAPI.renameProjectItem(oldPath, finalName)
      if (!result.success) {
        self._showToast('名前変更失敗: ' + result.error, 'error')
        input.replaceWith(nameEl)
      } else {
        if (self._currentFile === oldPath) self._currentFile = result.newPath
        await self.refresh()
        self.setCurrentFile(self._currentFile)
      }
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { committed = true; input.replaceWith(nameEl) }
    })
  }

  // ─── インライン新規作成 ───────────────────────────────────────────────────────

  _addInlineInput(parentDir, containerEl, depth, isFolder) {
    var self = this
    var emptyEl = containerEl.querySelector('.exp-empty')
    if (emptyEl) emptyEl.remove()

    var indent = depth * 14
    var wrapper = document.createElement('div')
    wrapper.className = 'exp-file exp-creating'
    wrapper.innerHTML =
      '<span class="exp-indent" style="width:' + indent + 'px"></span>' +
      '<span class="exp-icon">' + (isFolder ? '📁' : '📄') + '</span>'
    var input = document.createElement('input')
    input.type = 'text'
    input.placeholder = isFolder ? 'フォルダ名' : 'ファイル名.json'
    input.className = 'exp-inline-input'
    wrapper.appendChild(input)
    containerEl.prepend(wrapper)
    input.focus()

    var committed = false
    var commit = async function() {
      if (committed) return
      committed = true
      wrapper.remove()
      var name = input.value.trim()
      if (!name) return
      var result = isFolder
        ? await window.electronAPI.createProjectFolder(parentDir, name)
        : await window.electronAPI.createProjectFile(parentDir, name, '{}')
      if (!result.success) {
        self._showToast('作成失敗: ' + result.error, 'error')
      } else if (!isFolder && self._onFileSelect) {
        self._onFileSelect(result.filePath)
      }
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { committed = true; wrapper.remove() }
    })
  }

  // ─── 削除 ────────────────────────────────────────────────────────────────────

  async _deleteItem(itemPath, isDir) {
    var self = this
    var name = itemPath.replace(/\\/g, '/').split('/').pop()
    var msg = isDir
      ? 'フォルダ「' + name + '」を削除しますか？（空のフォルダのみ削除できます）'
      : 'ファイル「' + name + '」を削除しますか？'
    if (!confirm(msg)) return
    var result = await window.electronAPI.deleteProjectItem(itemPath, isDir)
    if (!result.success) {
      self._showToast('削除失敗: ' + result.error, 'error')
    } else if (self._currentFile === itemPath) {
      self._currentFile = null
      if (self._onFileSelect) self._onFileSelect(null)
    }
  }

  // ─── ユーティリティ ───────────────────────────────────────────────────────────

  _getDepth(itemPath) {
    if (!this._folderPath) return 0
    var rel = itemPath.replace(/\\/g, '/').slice(this._folderPath.replace(/\\/g, '/').length)
    return rel.split('/').filter(Boolean).length - 1
  }

  _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

window.ProjectExplorer = ProjectExplorer
