import { ParsedDocument } from './parser';
import { ExtensionSettings } from './settings';

export function nonce(): string {
  let t = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) { t += c.charAt(Math.floor(Math.random() * c.length)); }
  return t;
}

export function getHtml(data: ParsedDocument, settings: ExtensionSettings): string {
  const n = nonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}';">
  <style>${STYLES}</style>
</head>
<body>
  <div id="dropOverlay" class="drop-overlay hidden">
    <div class="drop-message">&#128194; Drop open-items.md here</div>
  </div>
  <div id="app"></div>
  <script nonce="${n}">
    var vscode = acquireVsCodeApi();
    ${WEBVIEW_SCRIPT}
    renderApp(${JSON.stringify(data)}, ${JSON.stringify(settings)});
    initDragDrop();
  </script>
</body>
</html>`;
}

export function getNoFileHtml(): string {
  const n = nonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}';">
  <style>${STYLES}</style>
</head>
<body>
  <div id="dropZone" class="drop-zone">
    <div class="empty-icon">&#128203;</div>
    <h2>No open-items.md found</h2>
    <p>Open the file in an editor and click <strong>Use Active Editor</strong>,<br>
    choose it manually, or drop it from the OS file manager.</p>
    <div class="empty-actions">
      <button class="btn-primary" id="useActiveBtn">Use Active Editor</button>
      <button class="btn-secondary" id="pickFileBtn">Choose File&hellip;</button>
    </div>
  </div>
  <script nonce="${n}">
    var vscode = acquireVsCodeApi();
    ${DRAG_SCRIPT}
    initDropZone(document.getElementById('dropZone'));
    document.getElementById('useActiveBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'useActiveFile' });
    });
    document.getElementById('pickFileBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'pickFile' });
    });
  </script>
</body>
</html>`;
}

export function getErrorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>${STYLES}</style>
</head>
<body>
  <div class="empty-state">
    <div class="empty-icon">&#9888;&#65039;</div>
    <h2>Error reading file</h2>
    <p>Could not read or parse <code>open-items.md</code>.</p>
  </div>
</body>
</html>`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  padding: 16px 20px;
}
code {
  font-family: var(--vscode-editor-font-family, monospace);
  background: var(--vscode-textCodeBlock-background);
  padding: 1px 5px; border-radius: 3px; font-size: 0.9em;
}

/* drop overlay */
.drop-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: color-mix(in srgb, var(--vscode-editor-background) 85%, transparent);
  border: 2px dashed var(--vscode-focusBorder);
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.drop-overlay.hidden { display: none; }
.drop-message {
  font-size: 1.1em; font-weight: 600; color: var(--vscode-focusBorder);
  padding: 16px 24px; background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-focusBorder); border-radius: 8px;
}

/* drop zone (empty state) */
.drop-zone {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 80vh;
  text-align: center; gap: 12px;
  border: 2px dashed var(--vscode-panel-border);
  border-radius: 8px; padding: 32px;
  transition: border-color 0.15s, background 0.15s;
}
.drop-zone.dragover {
  border-color: var(--vscode-focusBorder);
  background: color-mix(in srgb, var(--vscode-focusBorder) 8%, transparent);
}
.drop-zone .empty-icon { font-size: 3em; }
.drop-zone h2 { font-size: 1.1em; color: var(--vscode-foreground); }
.drop-zone p { font-size: 0.88em; color: var(--vscode-descriptionForeground); }
.empty-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }

/* header */
.header { margin-bottom: 16px; }
.header-row {
  display: flex; align-items: center;
  justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 4px;
}
.header-row h1 { font-size: 1.3em; font-weight: 600; }
.header-actions { display: flex; align-items: center; gap: 6px; }
.last-updated { font-size: 0.82em; color: var(--vscode-descriptionForeground); }

/* stats */
.stats {
  display: flex; flex-wrap: wrap; gap: 16px;
  padding: 12px 0 14px;
  border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 6px;
}
.stat { display: flex; flex-direction: column; align-items: center; min-width: 44px; }
.stat-count { font-size: 1.6em; font-weight: 700; line-height: 1.1; }
.stat-label { font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
.stat-count.done-color    { color: var(--vscode-testing-iconPassed, #4caf50); }
.stat-count.partial-color { color: var(--vscode-charts-orange, #d18616); }
.stat-count.future-color  { color: var(--vscode-charts-purple, #b267e6); }
.stat-count.pct-color     { color: var(--vscode-testing-iconPassed, #4caf50); }

/* progress */
.progress-wrap {
  width: 100%; height: 5px; background: var(--vscode-panel-border);
  border-radius: 3px; overflow: hidden; margin-bottom: 16px;
}
.progress-bar {
  height: 100%; background: var(--vscode-testing-iconPassed, #4caf50);
  border-radius: 3px; transition: width 0.4s ease;
}

/* controls */
.controls { margin-bottom: 16px; }
.controls-top { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.controls-top .search-input { flex: 1; margin-bottom: 0; }
.search-input {
  width: 100%; padding: 6px 10px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, transparent);
  border-radius: 4px;
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
  outline: none;
}
.search-input:focus { border-color: var(--vscode-focusBorder); }
.search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
.sort-select {
  padding: 5px 8px;
  background: var(--vscode-dropdown-background, var(--vscode-input-background));
  color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
  border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border, transparent));
  border-radius: 4px;
  font-family: var(--vscode-font-family); font-size: 0.82em;
  cursor: pointer; outline: none; white-space: nowrap;
}
.sort-select:focus { border-color: var(--vscode-focusBorder); }

.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.filter-btn {
  padding: 4px 10px; border-radius: 12px;
  border: 1px solid var(--vscode-panel-border);
  background: transparent; color: var(--vscode-foreground);
  cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family);
  transition: background 0.15s, color 0.15s;
}
.filter-btn:hover { background: var(--vscode-list-hoverBackground); }
.filter-btn.active {
  background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-background);
}

/* modules grid */
.modules {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr));
  gap: 12px;
}

/* module card */
.module-card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; overflow: hidden; }
.module-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; cursor: pointer;
  background: var(--vscode-sideBarSectionHeader-background, var(--vscode-editor-background));
  user-select: none; gap: 8px;
}
.module-header:hover { background: var(--vscode-list-hoverBackground); }
.module-title {
  font-weight: 600; font-size: 0.95em; flex: 1;
  cursor: text;
}
.module-title:hover { text-decoration: underline dotted; }
.module-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mini-progress { width: 56px; height: 4px; background: var(--vscode-panel-border); border-radius: 2px; overflow: hidden; }
.mini-progress-fill { height: 100%; background: var(--vscode-testing-iconPassed, #4caf50); border-radius: 2px; }
.module-count { font-size: 0.78em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
.chevron { font-size: 0.65em; color: var(--vscode-descriptionForeground); transition: transform 0.2s; display: inline-block; }
.module-card.collapsed .chevron { transform: rotate(-90deg); }
.module-card.collapsed .module-body { display: none; }

.module-body { padding: 8px 12px 10px; }
.module-context { font-size: 0.83em; color: var(--vscode-descriptionForeground); padding-bottom: 8px; line-height: 1.5; }

/* subsection */
.subsection { margin-top: 10px; }
.subsection-title {
  font-size: 0.78em; font-weight: 600; color: var(--vscode-descriptionForeground);
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 4px 0; margin-bottom: 4px;
  border-bottom: 1px solid var(--vscode-panel-border);
  cursor: text;
}
.subsection-title:hover { text-decoration: underline dotted; }

/* items list */
.items-list { list-style: none; }
.item {
  display: flex; align-items: flex-start;
  gap: 5px; padding: 5px 0;
  border-bottom: 1px solid var(--vscode-panel-border);
  transition: background 0.1s;
}
.item:last-child { border-bottom: none; }
.item.dragging { opacity: 0.35; }
.item.drag-over-top    { border-top: 2px solid var(--vscode-focusBorder) !important; }
.item.drag-over-bottom { border-bottom: 2px solid var(--vscode-focusBorder) !important; }

/* drag handle */
.drag-handle {
  flex-shrink: 0; width: 10px; padding-top: 3px;
  color: var(--vscode-descriptionForeground);
  opacity: 0; cursor: grab; font-size: 11px; line-height: 1.4;
  transition: opacity 0.1s; user-select: none;
}
.item:hover .drag-handle { opacity: 0.6; }
.item[draggable="true"] .drag-handle { cursor: grab; }

/* checkbox */
.item-checkbox {
  flex-shrink: 0; width: 14px; height: 14px; margin-top: 3px;
  cursor: pointer; accent-color: var(--vscode-testing-iconPassed, #4caf50);
}
.item-body { flex: 1; min-width: 0; }
.item-text { font-size: 0.88em; line-height: 1.45; word-break: break-word; }
.item-text.done {
  text-decoration: line-through;
  color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground));
}
.item-text-content { cursor: text; }
.item-text-content:hover { text-decoration: underline dotted; }
.item-badge { display: inline-block; font-size: 0.75em; margin-left: 4px; vertical-align: middle; opacity: 0.8; }
.item-date { font-size: 0.75em; color: var(--vscode-descriptionForeground); font-style: italic; margin-left: 6px; }
.item-note { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px; line-height: 1.4; word-break: break-word; }

/* inline edit input */
.inline-edit-input {
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-focusBorder);
  border-radius: 2px; padding: 1px 5px;
  font-family: var(--vscode-font-family); font-size: inherit;
  width: 100%; outline: none;
}

/* buttons */
.btn-primary {
  padding: 7px 16px; background: var(--vscode-button-background);
  color: var(--vscode-button-foreground); border: none; border-radius: 4px;
  cursor: pointer; font-size: 0.9em; font-family: var(--vscode-font-family);
}
.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.btn-secondary {
  padding: 4px 10px; background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px;
  cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family);
}
.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.btn-icon {
  padding: 3px 7px; background: transparent;
  color: var(--vscode-descriptionForeground);
  border: 1px solid var(--vscode-panel-border); border-radius: 3px;
  cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family); line-height: 1.4;
}
.btn-icon:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
.btn-icon-danger:hover {
  background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
  color: var(--vscode-errorForeground, #f48771);
  border-color: var(--vscode-inputValidation-errorBorder, #be1100);
}

/* empty / error */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: 60vh;
  text-align: center; color: var(--vscode-descriptionForeground); gap: 10px;
}
.empty-icon { font-size: 3em; }
.empty-state h2 { font-size: 1.1em; color: var(--vscode-foreground); }
.empty-state p { font-size: 0.9em; line-height: 1.6; }
`;

// ── Drag-drop for file loading (shared between views) ─────────────────────────

const DRAG_SCRIPT = `
function handleDropUri(uri) {
  if (!uri) { return; }
  uri = uri.split('\\n')[0].trim();
  vscode.postMessage({ command: 'dropFile', uri: uri });
}

function initDropZone(zone) {
  zone.addEventListener('dragover', function(e) {
    e.preventDefault(); e.stopPropagation();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', function(e) {
    if (!zone.contains(e.relatedTarget)) { zone.classList.remove('dragover'); }
  });
  zone.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation();
    zone.classList.remove('dragover');
    var uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    handleDropUri(uri);
  });
}
`;

// ── Main webview script ───────────────────────────────────────────────────────

const WEBVIEW_SCRIPT = `
${DRAG_SCRIPT}

// ── state ──
var activeFilter = 'all';
var searchQuery = '';
var currentSort = 'manual';
var currentSettings = null;
var isItemDrag = false;

function saveState() {
  vscode.setState({ currentSort: currentSort, activeFilter: activeFilter });
}

// ── utils ──
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── sort ──
var STATUS_ORDER = { open: 0, partial: 1, future: 2, done: 3 };

function sortedItems(items, strategy) {
  if (strategy === 'manual') { return items.slice(); }
  return items.slice().sort(function(a, b) {
    switch (strategy) {
      case 'status':
        return (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
      case 'alpha':
        return a.text.localeCompare(b.text);
      case 'done-last':
        if (a.status === 'done' && b.status !== 'done') { return 1; }
        if (a.status !== 'done' && b.status === 'done') { return -1; }
        return 0;
      case 'done-first':
        if (a.status === 'done' && b.status !== 'done') { return -1; }
        if (a.status !== 'done' && b.status === 'done') { return 1; }
        return 0;
    }
    return 0;
  });
}

function applyDomSort(strategy) {
  document.querySelectorAll('.items-list').forEach(function(list) {
    var items = Array.from(list.querySelectorAll(':scope > .item'));
    if (items.length <= 1) { return; }
    var sorted;
    if (strategy === 'manual') {
      sorted = items.slice().sort(function(a, b) {
        return (parseInt(a.getAttribute('data-orig-idx')) || 0) -
               (parseInt(b.getAttribute('data-orig-idx')) || 0);
      });
    } else {
      sorted = items.slice().sort(function(a, b) {
        var sa = a.getAttribute('data-status') || 'open';
        var sb = b.getAttribute('data-status') || 'open';
        var ta = a.getAttribute('data-text') || '';
        var tb = b.getAttribute('data-text') || '';
        switch (strategy) {
          case 'status':
            return (STATUS_ORDER[sa] || 0) - (STATUS_ORDER[sb] || 0);
          case 'alpha':
            return ta.localeCompare(tb);
          case 'done-last':
            if (sa === 'done' && sb !== 'done') { return 1; }
            if (sa !== 'done' && sb === 'done') { return -1; }
            return 0;
          case 'done-first':
            if (sa === 'done' && sb !== 'done') { return -1; }
            if (sa !== 'done' && sb === 'done') { return 1; }
            return 0;
        }
        return 0;
      });
    }
    sorted.forEach(function(item) { list.appendChild(item); });
  });
  // make items draggable only in manual sort
  document.querySelectorAll('.item').forEach(function(item) {
    if (strategy === 'manual') {
      item.setAttribute('draggable', 'true');
    } else {
      item.removeAttribute('draggable');
    }
  });
}

// ── filter ──
function applyFilter() {
  var filter = activeFilter;
  var query = searchQuery.toLowerCase();
  document.querySelectorAll('.item').forEach(function(item) {
    var status = item.getAttribute('data-status') || '';
    if (status === 'done' && currentSettings && !currentSettings.showDoneItems) {
      item.style.display = 'none'; return;
    }
    if (status === 'future' && currentSettings && !currentSettings.showFutureItems) {
      item.style.display = 'none'; return;
    }
    var text = item.textContent.toLowerCase();
    item.style.display =
      (filter === 'all' || status === filter) && (!query || text.indexOf(query) >= 0)
        ? '' : 'none';
  });
  document.querySelectorAll('.module-card').forEach(function(card) {
    var visible = Array.from(card.querySelectorAll('.item')).some(function(i) {
      return i.style.display !== 'none';
    });
    card.style.display = visible ? '' : 'none';
  });
}

// ── render item ──
function renderItem(item, origIdx) {
  var checked = item.status === 'done' ? ' checked' : '';
  var textClass = item.status === 'done' ? 'item-text done' : 'item-text';
  var badge = '';
  if (item.status === 'partial') { badge = '<span class="item-badge">&#128260;</span>'; }
  if (item.status === 'future')  { badge = '<span class="item-badge">&#128302;</span>'; }
  var dateHtml = item.date ? '<span class="item-date">' + esc(item.date) + '</span>' : '';
  var noteHtml = item.note
    ? '<div class="item-note" data-raw="' + encodeURIComponent(item.rawLine || '') + '">' + esc(item.note) + '</div>'
    : '';
  var rawKey = encodeURIComponent(item.rawLine || '');
  return (
    '<li class="item" draggable="true" data-status="' + item.status + '"' +
        ' data-raw="' + rawKey + '" data-text="' + esc(item.text) + '"' +
        ' data-orig-idx="' + origIdx + '">' +
      '<span class="drag-handle" title="Drag to reorder">&#8942;</span>' +
      '<input type="checkbox" class="item-checkbox"' + checked + '>' +
      '<div class="item-body">' +
        '<div class="' + textClass + '">' +
          '<span class="item-text-content" title="Double-click to edit">' + esc(item.text) + '</span>' +
          badge + dateHtml +
        '</div>' +
        noteHtml +
      '</div>' +
    '</li>'
  );
}

function renderItems(items) {
  if (!items.length) { return ''; }
  var sorted = sortedItems(items, currentSort);
  return '<ul class="items-list">' +
    sorted.map(function(item, i) { return renderItem(item, i); }).join('') +
  '</ul>';
}

// ── render module card ──
function getModuleStats(mod) {
  var all = mod.items.concat(
    mod.subSections.reduce(function(acc, s) { return acc.concat(s.items); }, [])
  );
  return { total: all.length, done: all.filter(function(i) { return i.status === 'done'; }).length };
}

function renderModuleCard(mod, idx, settings) {
  var ms = getModuleStats(mod);
  var pct = ms.total > 0 ? Math.round(ms.done / ms.total * 100) : 0;
  var collapsed = settings.collapseByDefault ? ' collapsed' : '';
  var subHtml = mod.subSections.map(function(sub) {
    return (
      '<div class="subsection">' +
        '<div class="subsection-title" data-raw="' + encodeURIComponent(sub.rawLine || '') + '"' +
            ' title="Double-click to edit">' + esc(sub.title) + '</div>' +
        renderItems(sub.items) +
      '</div>'
    );
  }).join('');
  return (
    '<div class="module-card' + collapsed + '" data-mod-idx="' + idx + '">' +
      '<div class="module-header">' +
        '<div class="module-title" data-raw="' + encodeURIComponent(mod.rawLine || '') + '"' +
            ' title="Double-click to edit">' + esc(mod.title) + '</div>' +
        '<div class="module-meta">' +
          '<div class="mini-progress"><div class="mini-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="module-count">' + ms.done + '/' + ms.total + '</span>' +
          '<span class="chevron">&#9660;</span>' +
        '</div>' +
      '</div>' +
      '<div class="module-body">' +
        (mod.context ? '<div class="module-context">' + esc(mod.context) + '</div>' : '') +
        renderItems(mod.items) +
        subHtml +
      '</div>' +
    '</div>'
  );
}

// ── inline editing ──
function startInlineEdit(el, originalText, onSave) {
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = originalText;
  el.replaceChildren(input);
  input.focus();
  input.select();

  var saved = false;
  function save() {
    if (saved) { return; }
    saved = true;
    var newText = input.value.trim();
    if (newText && newText !== originalText) {
      onSave(newText);
      // optimistic: show new text; watcher will re-render
      el.textContent = newText;
    } else {
      el.textContent = originalText;
    }
  }
  function cancel() {
    if (saved) { return; }
    saved = true;
    el.textContent = originalText;
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
  });
}

function initInlineEdit(root) {
  root.addEventListener('dblclick', function(e) {
    e.stopPropagation();

    // item text
    var textContent = e.target.closest('.item-text-content');
    if (textContent) {
      var item = textContent.closest('.item');
      var rawLine = decodeURIComponent(item.getAttribute('data-raw') || '');
      var originalText = item.getAttribute('data-text') || textContent.textContent.trim();
      startInlineEdit(textContent, originalText, function(newText) {
        item.setAttribute('data-text', newText);
        vscode.postMessage({ command: 'editItem', rawLine: rawLine, newText: newText });
      });
      return;
    }

    // module title
    var modTitle = e.target.closest('.module-title');
    if (modTitle) {
      var rawLine2 = decodeURIComponent(modTitle.getAttribute('data-raw') || '');
      var orig2 = modTitle.textContent.trim();
      startInlineEdit(modTitle, orig2, function(newText) {
        vscode.postMessage({ command: 'editHeader', rawLine: rawLine2, newText: newText });
      });
      return;
    }

    // subsection title
    var subTitle = e.target.closest('.subsection-title');
    if (subTitle) {
      var rawLine3 = decodeURIComponent(subTitle.getAttribute('data-raw') || '');
      var orig3 = subTitle.textContent.trim();
      startInlineEdit(subTitle, orig3, function(newText) {
        vscode.postMessage({ command: 'editHeader', rawLine: rawLine3, newText: newText });
      });
      return;
    }
  });
}

// ── drag-to-reorder items ──
function initItemReorder(root) {
  var dragging = null;
  var dragOverEl = null;
  var insertBefore = true;

  root.addEventListener('dragstart', function(e) {
    var item = e.target.closest('.item[draggable="true"]');
    if (!item) { return; }
    isItemDrag = true;
    dragging = item;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(function() { item.classList.add('dragging'); }, 0);
  });

  root.addEventListener('dragover', function(e) {
    var item = e.target.closest('.item[draggable="true"]');
    if (!item || item === dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    root.querySelectorAll('.item').forEach(function(i) {
      i.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    var rect = item.getBoundingClientRect();
    insertBefore = e.clientY < rect.top + rect.height / 2;
    item.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom');
    dragOverEl = item;
  });

  root.addEventListener('dragleave', function(e) {
    if (!root.contains(e.relatedTarget)) {
      root.querySelectorAll('.item').forEach(function(i) {
        i.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      dragOverEl = null;
    }
  });

  root.addEventListener('drop', function(e) {
    e.stopPropagation();
    root.querySelectorAll('.item').forEach(function(i) {
      i.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
    isItemDrag = false;

    if (!dragging || !dragOverEl) { dragging = null; dragOverEl = null; return; }

    var list = dragging.closest('.items-list');
    var targetList = dragOverEl.closest('.items-list');
    if (!list || list !== targetList) { dragging = null; dragOverEl = null; return; }

    var oldOrder = Array.from(list.querySelectorAll(':scope > .item'))
      .map(function(i) { return decodeURIComponent(i.getAttribute('data-raw') || ''); });

    if (insertBefore) {
      list.insertBefore(dragging, dragOverEl);
    } else {
      list.insertBefore(dragging, dragOverEl.nextSibling);
    }

    var newOrder = Array.from(list.querySelectorAll(':scope > .item'))
      .map(function(i) { return decodeURIComponent(i.getAttribute('data-raw') || ''); });

    vscode.postMessage({ command: 'reorderItems', oldOrder: oldOrder, newOrder: newOrder });
    dragging = null; dragOverEl = null;
  });

  root.addEventListener('dragend', function() {
    isItemDrag = false;
    if (dragging) { dragging.classList.remove('dragging'); }
    root.querySelectorAll('.item').forEach(function(i) {
      i.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    dragging = null; dragOverEl = null;
  });
}

// ── full-body file-drop overlay ──
function initDragDrop() {
  var overlay = document.getElementById('dropOverlay');
  var timer = null;
  document.addEventListener('dragover', function(e) {
    if (isItemDrag) { return; }
    e.preventDefault();
    overlay.classList.remove('hidden');
    clearTimeout(timer);
    timer = setTimeout(function() { overlay.classList.add('hidden'); }, 200);
  });
  document.addEventListener('drop', function(e) {
    if (isItemDrag) { return; }
    e.preventDefault();
    clearTimeout(timer);
    overlay.classList.add('hidden');
    var uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri) { handleDropUri(uri); }
  });
}

// ── main render ──
function renderApp(data, settings) {
  currentSettings = settings;

  // restore persisted ui state
  var state = vscode.getState() || {};
  currentSort = state.currentSort || settings.defaultSort;
  activeFilter = state.activeFilter || 'all';

  var app = document.getElementById('app');
  var s = data.stats;
  var pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
  var html = '';

  // header
  html += '<div class="header"><div class="header-row"><h1>Open Items</h1>';
  html += '<div class="header-actions">';
  html += '<button class="btn-icon" id="useActiveBtn" title="Use active editor file">&#128196;</button>';
  html += '<button class="btn-icon" id="changeFileBtn" title="Choose file">&#128194;</button>';
  html += '<button class="btn-icon btn-icon-danger" id="clearFileBtn" title="Clear — return to empty state">&#10005;</button>';
  if (data.filePath) { html += '<button class="btn-secondary" id="openFileBtn">Open File &#8599;</button>'; }
  html += '</div></div>';
  if (data.lastUpdated) { html += '<div class="last-updated">Last updated: ' + esc(data.lastUpdated) + '</div>'; }
  html += '</div>';

  // stats
  html += '<div class="stats">';
  html += '<div class="stat"><span class="stat-count">' + s.total + '</span><span class="stat-label">Total</span></div>';
  html += '<div class="stat"><span class="stat-count done-color">' + s.done + '</span><span class="stat-label">Done</span></div>';
  html += '<div class="stat"><span class="stat-count partial-color">' + s.partial + '</span><span class="stat-label">Partial</span></div>';
  html += '<div class="stat"><span class="stat-count">' + s.open + '</span><span class="stat-label">Open</span></div>';
  if (s.future > 0) { html += '<div class="stat"><span class="stat-count future-color">' + s.future + '</span><span class="stat-label">Future</span></div>'; }
  html += '<div class="stat"><span class="stat-count pct-color">' + pct + '%</span><span class="stat-label">Complete</span></div>';
  html += '</div>';
  html += '<div class="progress-wrap"><div class="progress-bar" style="width:' + pct + '%"></div></div>';

  // controls
  html += '<div class="controls">';
  html += '<div class="controls-top">';
  html += '<input type="text" id="searchInput" class="search-input" placeholder="Filter items..." autocomplete="off" />';
  html += '<select id="sortSelect" class="sort-select">';
  html += '<option value="manual">As in file</option>';
  html += '<option value="status">By status</option>';
  html += '<option value="alpha">Alphabetical</option>';
  html += '<option value="done-last">Done last</option>';
  html += '<option value="done-first">Done first</option>';
  html += '</select>';
  html += '</div>';
  html += '<div class="filters">';
  html += '<button class="filter-btn" data-filter="all">All (' + s.total + ')</button>';
  html += '<button class="filter-btn" data-filter="open">&#9744; Open (' + s.open + ')</button>';
  html += '<button class="filter-btn" data-filter="partial">&#128260; Partial (' + s.partial + ')</button>';
  if (settings.showDoneItems) {
    html += '<button class="filter-btn" data-filter="done">&#9989; Done (' + s.done + ')</button>';
  }
  if (settings.showFutureItems && s.future > 0) {
    html += '<button class="filter-btn" data-filter="future">&#128302; Future (' + s.future + ')</button>';
  }
  html += '</div></div>';

  // modules
  html += '<div class="modules" id="modulesGrid">';
  data.modules.forEach(function(mod, idx) { html += renderModuleCard(mod, idx, settings); });
  html += '</div>';

  app.innerHTML = html;

  // restore sort selector and active filter
  var sortSelect = document.getElementById('sortSelect');
  if (sortSelect) { sortSelect.value = currentSort; }
  // set active filter button
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === activeFilter);
  });

  // apply initial sort if not manual
  if (currentSort !== 'manual') { applyDomSort(currentSort); }
  else {
    document.querySelectorAll('.item').forEach(function(item) {
      item.setAttribute('draggable', 'true');
    });
  }

  // apply initial filter
  applyFilter();

  // ── wire events ──
  var grid = document.getElementById('modulesGrid');

  // accordion
  grid.addEventListener('click', function(e) {
    if (e.target.closest('.inline-edit-input')) { return; }
    var header = e.target.closest('.module-header');
    if (header && !e.target.closest('.module-title')) {
      var card = header.closest('.module-card');
      if (card) { card.classList.toggle('collapsed'); }
    }
  });

  // checkbox toggle
  grid.addEventListener('change', function(e) {
    var target = e.target;
    if (target.type !== 'checkbox' || !target.classList.contains('item-checkbox')) { return; }
    var item = target.closest('.item');
    if (!item) { return; }
    var textEl = item.querySelector('.item-text');
    if (textEl) {
      if (target.checked) { textEl.classList.add('done'); } else { textEl.classList.remove('done'); }
    }
    item.setAttribute('data-status', target.checked ? 'done' : 'open');
    if (activeFilter !== 'all') { applyFilter(); }
    vscode.postMessage({ command: 'toggleItem', rawLine: decodeURIComponent(item.getAttribute('data-raw') || '') });
  });

  // inline edit
  initInlineEdit(grid);

  // item reorder
  initItemReorder(grid);

  // header buttons
  var useActiveBtn = document.getElementById('useActiveBtn');
  if (useActiveBtn) { useActiveBtn.addEventListener('click', function() { vscode.postMessage({ command: 'useActiveFile' }); }); }
  var changeBtn = document.getElementById('changeFileBtn');
  if (changeBtn) { changeBtn.addEventListener('click', function() { vscode.postMessage({ command: 'pickFile' }); }); }
  var clearBtn = document.getElementById('clearFileBtn');
  if (clearBtn) { clearBtn.addEventListener('click', function() { vscode.postMessage({ command: 'clearFile' }); }); }
  var openBtn = document.getElementById('openFileBtn');
  if (openBtn) { openBtn.addEventListener('click', function() { vscode.postMessage({ command: 'openFile' }); }); }

  // search
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', function(e) {
      searchQuery = e.target.value;
      saveState();
      applyFilter();
    });
  }

  // filter buttons
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter') || 'all';
      saveState();
      applyFilter();
    });
  });

  // sort selector
  if (sortSelect) {
    sortSelect.addEventListener('change', function() {
      currentSort = sortSelect.value;
      saveState();
      applyDomSort(currentSort);
      applyFilter();
    });
  }
}
`;
