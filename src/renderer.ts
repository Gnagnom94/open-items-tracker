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
    document.getElementById('useActiveBtn').addEventListener('click', function() { vscode.postMessage({ command: 'useActiveFile' }); });
    document.getElementById('pickFileBtn').addEventListener('click', function() { vscode.postMessage({ command: 'pickFile' }); });
  </script>
</body>
</html>`;
}

export function getErrorHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>${STYLES}</style>
</head>
<body><div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div><h2>Error reading file</h2><p>Could not read or parse <code>open-items.md</code>.</p></div></body></html>`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px 20px; }
code { font-family: var(--vscode-editor-font-family, monospace); background: var(--vscode-textCodeBlock-background); padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }

.drop-overlay { position: fixed; inset: 0; z-index: 200; background: color-mix(in srgb, var(--vscode-editor-background) 85%, transparent); border: 2px dashed var(--vscode-focusBorder); display: flex; align-items: center; justify-content: center; pointer-events: none; }
.drop-overlay.hidden { display: none; }
.drop-message { font-size: 1.1em; font-weight: 600; color: var(--vscode-focusBorder); padding: 16px 24px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-focusBorder); border-radius: 8px; }

.drop-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; text-align: center; gap: 12px; border: 2px dashed var(--vscode-panel-border); border-radius: 8px; padding: 32px; transition: border-color 0.15s, background 0.15s; }
.drop-zone.dragover { border-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-focusBorder) 8%, transparent); }
.drop-zone .empty-icon { font-size: 3em; }
.drop-zone h2 { font-size: 1.1em; color: var(--vscode-foreground); }
.drop-zone p { font-size: 0.88em; color: var(--vscode-descriptionForeground); }
.empty-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }

.header { margin-bottom: 16px; }
.header-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
.header-row h1 { font-size: 1.3em; font-weight: 600; }
.header-actions { display: flex; align-items: center; gap: 6px; }
.last-updated { font-size: 0.82em; color: var(--vscode-descriptionForeground); }

.stats { display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 0 14px; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 6px; }
.stat { display: flex; flex-direction: column; align-items: center; min-width: 44px; }
.stat-count { font-size: 1.6em; font-weight: 700; line-height: 1.1; }
.stat-label { font-size: 0.75em; color: var(--vscode-descriptionForeground); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
.stat-count.done-color    { color: var(--vscode-testing-iconPassed, #4caf50); }
.stat-count.partial-color { color: var(--vscode-charts-orange, #d18616); }
.stat-count.future-color  { color: var(--vscode-charts-purple, #b267e6); }
.stat-count.pct-color     { color: var(--vscode-testing-iconPassed, #4caf50); }

.progress-wrap { width: 100%; height: 5px; background: var(--vscode-panel-border); border-radius: 3px; overflow: hidden; margin-bottom: 16px; }
.progress-bar { height: 100%; background: var(--vscode-testing-iconPassed, #4caf50); border-radius: 3px; transition: width 0.4s ease; }

.controls { margin-bottom: 16px; }
.controls-top { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.controls-top .search-input { flex: 1; margin-bottom: 0; }
.search-input { width: 100%; padding: 6px 10px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); outline: none; }
.search-input:focus { border-color: var(--vscode-focusBorder); }
.search-input::placeholder { color: var(--vscode-input-placeholderForeground); }
.sort-select { padding: 5px 8px; background: var(--vscode-dropdown-background, var(--vscode-input-background)); color: var(--vscode-dropdown-foreground, var(--vscode-foreground)); border: 1px solid var(--vscode-dropdown-border, transparent); border-radius: 4px; font-family: var(--vscode-font-family); font-size: 0.82em; cursor: pointer; outline: none; white-space: nowrap; }
.sort-select:focus { border-color: var(--vscode-focusBorder); }

.filters { display: flex; flex-wrap: wrap; gap: 6px; }
.filter-btn { padding: 4px 10px; border-radius: 12px; border: 1px solid var(--vscode-panel-border); background: transparent; color: var(--vscode-foreground); cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family); transition: background 0.15s; }
.filter-btn:hover { background: var(--vscode-list-hoverBackground); }
.filter-btn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-background); }

.modules { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); gap: 12px; }
.btn-add-module-wrap { margin-top: 12px; }

/* module card */
.module-card { border: 1px solid var(--vscode-panel-border); border-radius: 6px; overflow: hidden; }
.module-card.mod-dragging { opacity: 0.35; }
.module-card.mod-drag-over-top    { border-top: 2px solid var(--vscode-focusBorder) !important; }
.module-card.mod-drag-over-bottom { border-bottom: 2px solid var(--vscode-focusBorder) !important; }

.module-header { display: flex; align-items: center; padding: 9px 12px; background: var(--vscode-sideBarSectionHeader-background, var(--vscode-editor-background)); user-select: none; gap: 6px; }
.module-header:hover { background: var(--vscode-list-hoverBackground); }

.module-drag-handle { flex-shrink: 0; color: var(--vscode-descriptionForeground); opacity: 0; cursor: grab; font-size: 11px; line-height: 1.4; padding: 0 2px; user-select: none; transition: opacity 0.1s; }
.module-header:hover .module-drag-handle { opacity: 0.6; }

.module-collapse { flex: 1; display: flex; align-items: center; gap: 6px; cursor: pointer; min-width: 0; }
.module-title { font-weight: 600; font-size: 0.95em; flex: 1; cursor: text; }
.module-title:hover { text-decoration: underline dotted; }
.module-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.mini-progress { width: 56px; height: 4px; background: var(--vscode-panel-border); border-radius: 2px; overflow: hidden; }
.mini-progress-fill { height: 100%; background: var(--vscode-testing-iconPassed, #4caf50); border-radius: 2px; }
.module-count { font-size: 0.78em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
.chevron { font-size: 0.65em; color: var(--vscode-descriptionForeground); transition: transform 0.2s; display: inline-block; }
.module-card.collapsed .chevron { transform: rotate(-90deg); }
.module-card.collapsed .module-body { display: none; }

.module-body { padding: 8px 12px 10px; }
.module-context { font-size: 0.83em; color: var(--vscode-descriptionForeground); padding-bottom: 8px; line-height: 1.5; cursor: text; }
.module-context:hover { text-decoration: underline dotted; }

/* subsection */
.subsection { margin-top: 10px; }
.subsection.sub-dragging { opacity: 0.35; }
.subsection.sub-drag-over-top    { border-top: 2px solid var(--vscode-focusBorder); }
.subsection.sub-drag-over-bottom { border-bottom: 2px solid var(--vscode-focusBorder); }
.subsection-header { display: flex; align-items: center; gap: 4px; padding: 3px 0; margin-bottom: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
.sub-drag-handle { flex-shrink: 0; color: var(--vscode-descriptionForeground); opacity: 0; cursor: grab; font-size: 10px; line-height: 1.4; padding: 0 2px; user-select: none; transition: opacity 0.1s; }
.subsection-header:hover .sub-drag-handle { opacity: 0.6; }
.subsection-title { flex: 1; font-size: 0.78em; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.06em; cursor: text; }
.subsection-title:hover { text-decoration: underline dotted; }

/* items list */
.items-list { list-style: none; }
.item { display: flex; align-items: flex-start; gap: 5px; padding: 5px 0; border-bottom: 1px solid var(--vscode-panel-border); }
.item:last-child { border-bottom: none; }
.item.dragging { opacity: 0.35; }
.item.drag-over-top    { border-top: 2px solid var(--vscode-focusBorder) !important; }
.item.drag-over-bottom { border-bottom: 2px solid var(--vscode-focusBorder) !important; }

.drag-handle { flex-shrink: 0; width: 10px; padding-top: 3px; color: var(--vscode-descriptionForeground); opacity: 0; cursor: grab; font-size: 11px; line-height: 1.4; transition: opacity 0.1s; user-select: none; }
.item:hover .drag-handle { opacity: 0.6; }

.item-checkbox { flex-shrink: 0; width: 14px; height: 14px; margin-top: 3px; cursor: pointer; accent-color: var(--vscode-testing-iconPassed, #4caf50); }
.item-body { flex: 1; min-width: 0; }
.item-text { font-size: 0.88em; line-height: 1.45; word-break: break-word; }
.item-text.done { text-decoration: line-through; color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground)); }
.item-text-content { cursor: text; }
.item-text-content:hover { text-decoration: underline dotted; }
.item-badge { display: inline-block; font-size: 0.75em; margin-left: 4px; vertical-align: middle; opacity: 0.8; }
.item-date { font-size: 0.75em; color: var(--vscode-descriptionForeground); font-style: italic; margin-left: 6px; }
.item-note { font-size: 0.8em; color: var(--vscode-descriptionForeground); margin-top: 2px; line-height: 1.4; word-break: break-word; cursor: text; }
.item-note:hover { text-decoration: underline dotted; }

/* delete button */
.btn-delete { flex-shrink: 0; padding: 1px 4px; background: transparent; color: var(--vscode-descriptionForeground); border: none; border-radius: 3px; cursor: pointer; font-size: 0.8em; opacity: 0; transition: opacity 0.1s, color 0.1s; line-height: 1.4; font-family: var(--vscode-font-family); }
.item:hover .btn-delete,
.module-header:hover .btn-delete,
.subsection-header:hover .btn-delete { opacity: 0.7; }
.btn-delete:hover { opacity: 1 !important; color: var(--vscode-errorForeground, #f48771); background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 12%, transparent); }

/* inline edit */
.inline-edit-input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-focusBorder); border-radius: 2px; padding: 1px 5px; font-family: var(--vscode-font-family); font-size: inherit; width: 100%; outline: none; }

/* add inline */
.add-input-wrapper { margin-top: 6px; }
.btn-add { display: block; width: 100%; padding: 4px 8px; background: transparent; color: var(--vscode-descriptionForeground); border: 1px dashed var(--vscode-panel-border); border-radius: 3px; cursor: pointer; font-size: 0.78em; font-family: var(--vscode-font-family); text-align: left; margin-top: 6px; opacity: 0.55; transition: opacity 0.15s, border-color 0.15s; }
.btn-add:hover { opacity: 1; border-color: var(--vscode-focusBorder); color: var(--vscode-foreground); }

/* generic buttons */
.btn-primary { padding: 7px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em; font-family: var(--vscode-font-family); }
.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.btn-secondary { padding: 4px 10px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family); }
.btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
.btn-icon { padding: 3px 7px; background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); border-radius: 3px; cursor: pointer; font-size: 0.82em; font-family: var(--vscode-font-family); line-height: 1.4; }
.btn-icon:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
.btn-icon-danger:hover { background: color-mix(in srgb, var(--vscode-errorForeground, #f48771) 12%, transparent); color: var(--vscode-errorForeground, #f48771); border-color: var(--vscode-errorForeground, #f48771); }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; color: var(--vscode-descriptionForeground); gap: 10px; }
.empty-icon { font-size: 3em; }
.empty-state h2 { font-size: 1.1em; color: var(--vscode-foreground); }
.empty-state p { font-size: 0.9em; line-height: 1.6; }
`;

// ── Shared file-drop script ───────────────────────────────────────────────────

const DRAG_SCRIPT = `
function handleDropUri(uri) {
  if (!uri) { return; }
  uri = uri.split('\\n')[0].trim();
  vscode.postMessage({ command: 'dropFile', uri: uri });
}
function initDropZone(zone) {
  zone.addEventListener('dragover', function(e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function(e) { if (!zone.contains(e.relatedTarget)) { zone.classList.remove('dragover'); } });
  zone.addEventListener('drop', function(e) {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover');
    var uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    handleDropUri(uri);
  });
}
`;

// ── Main webview script ───────────────────────────────────────────────────────

const WEBVIEW_SCRIPT = `
${DRAG_SCRIPT}

// state
var activeFilter = 'all';
var searchQuery = '';
var currentSort = 'manual';
var currentSettings = null;
var isItemDrag = false;
var isModuleDrag = false;
var isSubDrag = false;

function saveState() { vscode.setState({ currentSort: currentSort, activeFilter: activeFilter }); }

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── sort ──
var STATUS_ORDER = { open: 0, partial: 1, future: 2, done: 3 };
function sortedItems(items, strategy) {
  if (strategy === 'manual') { return items.slice(); }
  return items.slice().sort(function(a, b) {
    switch (strategy) {
      case 'status':    return (STATUS_ORDER[a.status]||0) - (STATUS_ORDER[b.status]||0);
      case 'alpha':     return a.text.localeCompare(b.text);
      case 'done-last':  return (a.status==='done'?1:0) - (b.status==='done'?1:0);
      case 'done-first': return (b.status==='done'?1:0) - (a.status==='done'?1:0);
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
      sorted = items.slice().sort(function(a,b){ return (parseInt(a.getAttribute('data-orig-idx'))||0)-(parseInt(b.getAttribute('data-orig-idx'))||0); });
    } else {
      sorted = items.slice().sort(function(a,b){
        var sa=a.getAttribute('data-status')||'open', sb=b.getAttribute('data-status')||'open';
        var ta=a.getAttribute('data-text')||'', tb=b.getAttribute('data-text')||'';
        switch(strategy){
          case 'status':    return (STATUS_ORDER[sa]||0)-(STATUS_ORDER[sb]||0);
          case 'alpha':     return ta.localeCompare(tb);
          case 'done-last':  return (sa==='done'?1:0)-(sb==='done'?1:0);
          case 'done-first': return (sb==='done'?1:0)-(sa==='done'?1:0);
        }
        return 0;
      });
    }
    sorted.forEach(function(item){ list.appendChild(item); });
  });
  document.querySelectorAll('.item').forEach(function(item){
    if (strategy==='manual') { item.setAttribute('draggable','true'); }
    else { item.removeAttribute('draggable'); }
  });
}

// ── filter ──
function applyFilter() {
  var filter = activeFilter, query = searchQuery.toLowerCase();
  document.querySelectorAll('.item').forEach(function(item) {
    var status = item.getAttribute('data-status')||'';
    if (status==='done'   && currentSettings && !currentSettings.showDoneItems)   { item.style.display='none'; return; }
    if (status==='future' && currentSettings && !currentSettings.showFutureItems) { item.style.display='none'; return; }
    var text = item.textContent.toLowerCase();
    item.style.display = (filter==='all'||status===filter) && (!query||text.indexOf(query)>=0) ? '' : 'none';
  });
  document.querySelectorAll('.module-card').forEach(function(card) {
    var items = Array.from(card.querySelectorAll('.item'));
    // empty module always visible; non-empty module visible if at least one item passes filter
    var visible = items.length === 0 || items.some(function(i){ return i.style.display!=='none'; });
    card.style.display = visible ? '' : 'none';
  });
}

// ── render item ──
function renderItem(item, origIdx) {
  var checked = item.status==='done' ? ' checked' : '';
  var textClass = item.status==='done' ? 'item-text done' : 'item-text';
  var badge = item.status==='partial' ? '<span class="item-badge">&#128260;</span>'
            : item.status==='future'  ? '<span class="item-badge">&#128302;</span>' : '';
  var dateHtml = item.date ? '<span class="item-date">'+esc(item.date)+'</span>' : '';
  var noteHtml = item.note
    ? '<div class="item-note" data-raw="'+encodeURIComponent(item.rawLine||'')+'" title="Double-click to edit">'+esc(item.note)+'</div>'
    : '';
  var rawKey = encodeURIComponent(item.rawLine||'');
  return (
    '<li class="item" draggable="true" data-status="'+item.status+'" data-raw="'+rawKey+'" data-text="'+esc(item.text)+'" data-orig-idx="'+origIdx+'">' +
      '<span class="drag-handle" title="Drag to reorder">&#8942;</span>' +
      '<input type="checkbox" class="item-checkbox"'+checked+'>' +
      '<div class="item-body">' +
        '<div class="'+textClass+'">' +
          '<span class="item-text-content" title="Double-click to edit">'+esc(item.text)+'</span>' +
          badge + dateHtml +
        '</div>' +
        noteHtml +
      '</div>' +
      '<button class="btn-delete" data-raw="'+rawKey+'" title="Delete item">&#10005;</button>' +
    '</li>'
  );
}

function renderItems(items, parentRaw) {
  var sorted = sortedItems(items, currentSort);
  var html = sorted.length > 0
    ? '<ul class="items-list">'+sorted.map(function(item,i){ return renderItem(item,i); }).join('')+'</ul>'
    : '';
  html += '<button class="btn-add btn-add-item" data-parent-raw="'+encodeURIComponent(parentRaw)+'">+ Add item</button>';
  return html;
}

// ── render module card ──
function getModuleStats(mod) {
  var all = mod.items.concat(mod.subSections.reduce(function(a,s){ return a.concat(s.items); },[]));
  return { total: all.length, done: all.filter(function(i){ return i.status==='done'; }).length };
}

function renderModuleCard(mod, idx, settings) {
  var ms = getModuleStats(mod);
  var pct = ms.total>0 ? Math.round(ms.done/ms.total*100) : 0;
  var collapsed = settings.collapseByDefault ? ' collapsed' : '';
  var modRawKey = encodeURIComponent(mod.rawLine||'');

  var subHtml = mod.subSections.map(function(sub) {
    var subRawKey = encodeURIComponent(sub.rawLine||'');
    return (
      '<div class="subsection" data-sub-raw="'+subRawKey+'">' +
        '<div class="subsection-header">' +
          '<span class="sub-drag-handle" title="Drag to reorder">&#8942;</span>' +
          '<div class="subsection-title" data-raw="'+subRawKey+'" title="Double-click to edit">'+esc(sub.title)+'</div>' +
          '<button class="btn-delete" data-sub-raw="'+subRawKey+'" title="Delete sub-section">&#10005;</button>' +
        '</div>' +
        renderItems(sub.items, sub.rawLine||'') +
      '</div>'
    );
  }).join('');

  return (
    '<div class="module-card'+collapsed+'" data-mod-idx="'+idx+'">' +
      '<div class="module-header">' +
        '<span class="module-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>' +
        '<div class="module-collapse">' +
          '<div class="module-title" data-raw="'+modRawKey+'" title="Double-click to edit">'+esc(mod.title)+'</div>' +
          '<div class="module-meta">' +
            '<div class="mini-progress"><div class="mini-progress-fill" style="width:'+pct+'%"></div></div>' +
            '<span class="module-count">'+ms.done+'/'+ms.total+'</span>' +
            '<span class="chevron">&#9660;</span>' +
          '</div>' +
        '</div>' +
        '<button class="btn-delete" data-mod-raw="'+modRawKey+'" title="Delete module">&#10005;</button>' +
      '</div>' +
      '<div class="module-body">' +
        (mod.context
          ? '<div class="module-context" data-mod-raw="'+modRawKey+'" title="Double-click to edit">'+esc(mod.context)+'</div>'
          : '') +
        (mod.subSections.length===0 ? renderItems(mod.items, mod.rawLine||'') : renderItems(mod.items, mod.rawLine||'')) +
        subHtml +
        '<button class="btn-add btn-add-subsection" data-mod-raw="'+modRawKey+'">+ Add sub-section</button>' +
      '</div>' +
    '</div>'
  );
}

// ── inline add input ──
function showAddInput(container, placeholder, onConfirm) {
  var existing = container.querySelector('.add-input-wrapper');
  if (existing) { existing.remove(); return; }
  var wrapper = document.createElement('div');
  wrapper.className = 'add-input-wrapper';
  var input = document.createElement('input');
  input.type = 'text'; input.className = 'inline-edit-input'; input.placeholder = placeholder;
  wrapper.appendChild(input); container.appendChild(wrapper); input.focus();
  var done = false;
  function finish(save) {
    if (done) { return; } done = true;
    var text = input.value.trim();
    wrapper.remove();
    if (save && text) { onConfirm(text); }
  }
  input.addEventListener('blur', function(){ finish(false); });
  input.addEventListener('keydown', function(e){
    if (e.key==='Enter') { e.preventDefault(); finish(true); }
    if (e.key==='Escape') { finish(false); }
  });
}

// ── inline text edit ──
function startInlineEdit(el, originalText, onSave) {
  var input = document.createElement('input');
  input.type='text'; input.className='inline-edit-input'; input.value=originalText;
  el.replaceChildren(input); input.focus(); input.select();
  var saved = false;
  function save() {
    if (saved) { return; } saved=true;
    var newText = input.value.trim();
    if (newText && newText!==originalText) { onSave(newText); el.textContent=newText; }
    else { el.textContent=originalText; }
  }
  function cancel() { if (saved) { return; } saved=true; el.textContent=originalText; }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function(e){
    if (e.key==='Enter') { e.preventDefault(); input.blur(); }
    if (e.key==='Escape') { input.removeEventListener('blur',save); cancel(); }
  });
}

function initInlineEdit(root) {
  root.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    var tc = e.target.closest('.item-text-content');
    if (tc) {
      var item = tc.closest('.item');
      var rawLine = decodeURIComponent(item.getAttribute('data-raw')||'');
      var origText = item.getAttribute('data-text') || tc.textContent.trim();
      startInlineEdit(tc, origText, function(t){ item.setAttribute('data-text',t); vscode.postMessage({command:'editItem',rawLine:rawLine,newText:t}); });
      return;
    }
    var mt = e.target.closest('.module-title');
    if (mt) {
      var raw = decodeURIComponent(mt.getAttribute('data-raw')||'');
      startInlineEdit(mt, mt.textContent.trim(), function(t){ vscode.postMessage({command:'editHeader',rawLine:raw,newText:t}); });
      return;
    }
    var st = e.target.closest('.subsection-title');
    if (st) {
      var raw2 = decodeURIComponent(st.getAttribute('data-raw')||'');
      startInlineEdit(st, st.textContent.trim(), function(t){ vscode.postMessage({command:'editHeader',rawLine:raw2,newText:t}); });
      return;
    }
    var ne = e.target.closest('.item-note');
    if (ne) {
      var raw3 = decodeURIComponent(ne.getAttribute('data-raw')||'');
      startInlineEdit(ne, ne.textContent.trim(), function(t){ vscode.postMessage({command:'editItemNote',rawLine:raw3,newNote:t}); });
      return;
    }
    var ctx = e.target.closest('.module-context');
    if (ctx) {
      var mraw = decodeURIComponent(ctx.getAttribute('data-mod-raw')||'');
      startInlineEdit(ctx, ctx.textContent.trim(), function(t){ vscode.postMessage({command:'editModuleContext',moduleRawLine:mraw,newContext:t}); });
      return;
    }
  });
}

// ── item drag-to-reorder ──
function initItemReorder(root) {
  var dragging=null, dragOverEl=null, insertBefore=true;
  root.addEventListener('mousedown', function(e){
    if (e.target.closest('.module-drag-handle') || e.target.closest('.sub-drag-handle')) { return; }
  });
  root.addEventListener('dragstart', function(e){
    var item = e.target.closest('.item[draggable="true"]');
    if (!item) { return; }
    if (isModuleDrag || isSubDrag) { return; }
    isItemDrag=true; dragging=item; e.dataTransfer.effectAllowed='move';
    setTimeout(function(){ item.classList.add('dragging'); },0);
  });
  root.addEventListener('dragover', function(e){
    if (!isItemDrag) { return; }
    var item = e.target.closest('.item[draggable="true"]');
    if (!item||item===dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    root.querySelectorAll('.item').forEach(function(i){ i.classList.remove('drag-over-top','drag-over-bottom'); });
    var rect=item.getBoundingClientRect(); insertBefore=e.clientY<rect.top+rect.height/2;
    item.classList.add(insertBefore?'drag-over-top':'drag-over-bottom'); dragOverEl=item;
  });
  root.addEventListener('dragleave', function(e){
    if (!root.contains(e.relatedTarget)) { root.querySelectorAll('.item').forEach(function(i){ i.classList.remove('drag-over-top','drag-over-bottom'); }); dragOverEl=null; }
  });
  root.addEventListener('drop', function(e){
    e.stopPropagation();
    root.querySelectorAll('.item').forEach(function(i){ i.classList.remove('dragging','drag-over-top','drag-over-bottom'); });
    isItemDrag=false;
    if (!dragging||!dragOverEl) { dragging=null; dragOverEl=null; return; }
    var list=dragging.closest('.items-list'), tlist=dragOverEl.closest('.items-list');
    if (!list||list!==tlist) { dragging=null; dragOverEl=null; return; }
    var oldOrder=Array.from(list.querySelectorAll(':scope > .item')).map(function(i){ return decodeURIComponent(i.getAttribute('data-raw')||''); });
    if (insertBefore) { list.insertBefore(dragging,dragOverEl); } else { list.insertBefore(dragging,dragOverEl.nextSibling); }
    var newOrder=Array.from(list.querySelectorAll(':scope > .item')).map(function(i){ return decodeURIComponent(i.getAttribute('data-raw')||''); });
    vscode.postMessage({command:'reorderItems',oldOrder:oldOrder,newOrder:newOrder});
    dragging=null; dragOverEl=null;
  });
  root.addEventListener('dragend', function(){
    isItemDrag=false;
    if (dragging) { dragging.classList.remove('dragging'); }
    root.querySelectorAll('.item').forEach(function(i){ i.classList.remove('drag-over-top','drag-over-bottom'); });
    dragging=null; dragOverEl=null;
  });
}

// ── module drag-to-reorder ──
function initModuleReorder(grid) {
  var dragging=null, dragOver=null, insertBefore=true;
  grid.addEventListener('mousedown', function(e){
    var handle = e.target.closest('.module-drag-handle');
    if (handle) { var card=handle.closest('.module-card'); if(card){card.setAttribute('draggable','true');} }
  });
  grid.addEventListener('dragstart', function(e){
    var card = e.target.closest('.module-card[draggable="true"]');
    if (!card) { return; }
    isModuleDrag=true; isItemDrag=false; dragging=card; e.dataTransfer.effectAllowed='move';
    setTimeout(function(){ card.classList.add('mod-dragging'); },0);
  });
  grid.addEventListener('dragover', function(e){
    if (!isModuleDrag) { return; }
    var card = e.target.closest('.module-card');
    if (!card||card===dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    grid.querySelectorAll('.module-card').forEach(function(c){ c.classList.remove('mod-drag-over-top','mod-drag-over-bottom'); });
    var rect=card.getBoundingClientRect(); insertBefore=e.clientY<rect.top+rect.height/2;
    card.classList.add(insertBefore?'mod-drag-over-top':'mod-drag-over-bottom'); dragOver=card;
  });
  grid.addEventListener('dragleave', function(e){
    if (!grid.contains(e.relatedTarget)) {
      grid.querySelectorAll('.module-card').forEach(function(c){ c.classList.remove('mod-drag-over-top','mod-drag-over-bottom'); });
      dragOver=null;
    }
  });
  grid.addEventListener('drop', function(e){
    if (!isModuleDrag) { return; }
    e.stopPropagation();
    grid.querySelectorAll('.module-card').forEach(function(c){ c.classList.remove('mod-dragging','mod-drag-over-top','mod-drag-over-bottom'); c.removeAttribute('draggable'); });
    isModuleDrag=false;
    if (!dragging||!dragOver) { dragging=null; dragOver=null; return; }
    var oldOrder=Array.from(grid.querySelectorAll(':scope > .module-card')).map(function(c){ return decodeURIComponent((c.querySelector('.module-title')||{getAttribute:function(){return '';}}).getAttribute('data-raw')||''); });
    if (insertBefore) { grid.insertBefore(dragging,dragOver); } else { grid.insertBefore(dragging,dragOver.nextSibling); }
    var newOrder=Array.from(grid.querySelectorAll(':scope > .module-card')).map(function(c){ return decodeURIComponent((c.querySelector('.module-title')||{getAttribute:function(){return '';}}).getAttribute('data-raw')||''); });
    vscode.postMessage({command:'reorderModules',oldOrder:oldOrder,newOrder:newOrder});
    dragging=null; dragOver=null;
  });
  grid.addEventListener('dragend', function(){
    isModuleDrag=false;
    grid.querySelectorAll('.module-card').forEach(function(c){ c.classList.remove('mod-dragging','mod-drag-over-top','mod-drag-over-bottom'); c.removeAttribute('draggable'); });
    dragging=null; dragOver=null;
  });
}

// ── subsection drag-to-reorder ──
function initSubSectionReorder(body, moduleRaw) {
  var dragging=null, dragOver=null, insertBefore=true;
  body.addEventListener('mousedown', function(e){
    var handle = e.target.closest('.sub-drag-handle');
    if (handle) { var sub=handle.closest('.subsection'); if(sub){sub.setAttribute('draggable','true');} }
  });
  body.addEventListener('dragstart', function(e){
    var sub = e.target.closest('.subsection[draggable="true"]');
    if (!sub) { return; }
    isSubDrag=true; isItemDrag=false; isModuleDrag=false; dragging=sub; e.dataTransfer.effectAllowed='move';
    setTimeout(function(){ sub.classList.add('sub-dragging'); },0);
  });
  body.addEventListener('dragover', function(e){
    if (!isSubDrag) { return; }
    var sub = e.target.closest('.subsection');
    if (!sub||sub===dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    body.querySelectorAll('.subsection').forEach(function(s){ s.classList.remove('sub-drag-over-top','sub-drag-over-bottom'); });
    var rect=sub.getBoundingClientRect(); insertBefore=e.clientY<rect.top+rect.height/2;
    sub.classList.add(insertBefore?'sub-drag-over-top':'sub-drag-over-bottom'); dragOver=sub;
  });
  body.addEventListener('dragleave', function(e){
    if (!body.contains(e.relatedTarget)) {
      body.querySelectorAll('.subsection').forEach(function(s){ s.classList.remove('sub-drag-over-top','sub-drag-over-bottom'); });
      dragOver=null;
    }
  });
  body.addEventListener('drop', function(e){
    if (!isSubDrag) { return; }
    e.stopPropagation();
    body.querySelectorAll('.subsection').forEach(function(s){ s.classList.remove('sub-dragging','sub-drag-over-top','sub-drag-over-bottom'); s.removeAttribute('draggable'); });
    isSubDrag=false;
    if (!dragging||!dragOver) { dragging=null; dragOver=null; return; }
    var oldOrder=Array.from(body.querySelectorAll('.subsection')).map(function(s){ return decodeURIComponent(s.getAttribute('data-sub-raw')||''); });
    if (insertBefore) { body.insertBefore(dragging,dragOver); } else { body.insertBefore(dragging,dragOver.nextSibling); }
    var newOrder=Array.from(body.querySelectorAll('.subsection')).map(function(s){ return decodeURIComponent(s.getAttribute('data-sub-raw')||''); });
    vscode.postMessage({command:'reorderSubSections',moduleRawLine:moduleRaw,oldOrder:oldOrder,newOrder:newOrder});
    dragging=null; dragOver=null;
  });
  body.addEventListener('dragend', function(){
    isSubDrag=false;
    body.querySelectorAll('.subsection').forEach(function(s){ s.classList.remove('sub-dragging','sub-drag-over-top','sub-drag-over-bottom'); s.removeAttribute('draggable'); });
    dragging=null; dragOver=null;
  });
}

// ── full-body file-drop overlay ──
function initDragDrop() {
  var overlay = document.getElementById('dropOverlay');
  var timer = null;
  document.addEventListener('dragover', function(e){
    if (isItemDrag||isModuleDrag||isSubDrag) { return; }
    e.preventDefault(); overlay.classList.remove('hidden');
    clearTimeout(timer); timer=setTimeout(function(){ overlay.classList.add('hidden'); },200);
  });
  document.addEventListener('drop', function(e){
    if (isItemDrag||isModuleDrag||isSubDrag) { return; }
    e.preventDefault(); clearTimeout(timer); overlay.classList.add('hidden');
    var uri = e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain');
    if (uri) { handleDropUri(uri); }
  });
}

// ── main render ──
function renderApp(data, settings) {
  currentSettings = settings;
  var state = vscode.getState()||{};
  currentSort = state.currentSort || settings.defaultSort;
  activeFilter = state.activeFilter || 'all';

  var app = document.getElementById('app');
  var s = data.stats;
  var pct = s.total>0 ? Math.round(s.done/s.total*100) : 0;
  var html = '';

  // header
  html += '<div class="header"><div class="header-row"><h1>Open Items</h1><div class="header-actions">';
  html += '<button class="btn-icon" id="useActiveBtn" title="Use active editor file">&#128196;</button>';
  html += '<button class="btn-icon" id="changeFileBtn" title="Choose file">&#128194;</button>';
  html += '<button class="btn-icon btn-icon-danger" id="clearFileBtn" title="Clear">&#10005;</button>';
  if (data.filePath) { html += '<button class="btn-secondary" id="openFileBtn">Open File &#8599;</button>'; }
  html += '</div></div>';
  if (data.lastUpdated) { html += '<div class="last-updated">Last updated: '+esc(data.lastUpdated)+'</div>'; }
  html += '</div>';

  // stats
  html += '<div class="stats">';
  html += '<div class="stat"><span class="stat-count">'+s.total+'</span><span class="stat-label">Total</span></div>';
  html += '<div class="stat"><span class="stat-count done-color">'+s.done+'</span><span class="stat-label">Done</span></div>';
  html += '<div class="stat"><span class="stat-count partial-color">'+s.partial+'</span><span class="stat-label">Partial</span></div>';
  html += '<div class="stat"><span class="stat-count">'+s.open+'</span><span class="stat-label">Open</span></div>';
  if (s.future>0) { html += '<div class="stat"><span class="stat-count future-color">'+s.future+'</span><span class="stat-label">Future</span></div>'; }
  html += '<div class="stat"><span class="stat-count pct-color">'+pct+'%</span><span class="stat-label">Complete</span></div>';
  html += '</div>';
  html += '<div class="progress-wrap"><div class="progress-bar" style="width:'+pct+'%"></div></div>';

  // controls
  html += '<div class="controls"><div class="controls-top">';
  html += '<input type="text" id="searchInput" class="search-input" placeholder="Filter items..." autocomplete="off" />';
  html += '<select id="sortSelect" class="sort-select">';
  html += '<option value="manual">As in file</option><option value="status">By status</option>';
  html += '<option value="alpha">Alphabetical</option><option value="done-last">Done last</option><option value="done-first">Done first</option>';
  html += '</select></div><div class="filters">';
  html += '<button class="filter-btn" data-filter="all">All ('+s.total+')</button>';
  html += '<button class="filter-btn" data-filter="open">&#9744; Open ('+s.open+')</button>';
  html += '<button class="filter-btn" data-filter="partial">&#128260; Partial ('+s.partial+')</button>';
  if (settings.showDoneItems) { html += '<button class="filter-btn" data-filter="done">&#9989; Done ('+s.done+')</button>'; }
  if (settings.showFutureItems && s.future>0) { html += '<button class="filter-btn" data-filter="future">&#128302; Future ('+s.future+')</button>'; }
  html += '</div></div>';

  // modules grid
  html += '<div class="modules" id="modulesGrid">';
  data.modules.forEach(function(mod,idx){ html += renderModuleCard(mod,idx,settings); });
  html += '</div>';
  html += '<div class="btn-add-module-wrap"><button class="btn-add btn-add-module">+ Add module</button></div>';

  app.innerHTML = html;

  // restore sort + filter
  var sortSelect = document.getElementById('sortSelect');
  if (sortSelect) { sortSelect.value = currentSort; }
  document.querySelectorAll('.filter-btn').forEach(function(btn){
    btn.classList.toggle('active', btn.getAttribute('data-filter')===activeFilter);
  });
  if (currentSort!=='manual') { applyDomSort(currentSort); }
  else { document.querySelectorAll('.item').forEach(function(item){ item.setAttribute('draggable','true'); }); }
  applyFilter();

  var grid = document.getElementById('modulesGrid');

  // accordion (click on module-collapse only, not title or delete)
  grid.addEventListener('click', function(e){
    if (e.target.closest('.inline-edit-input')) { return; }
    if (e.target.closest('.btn-delete') || e.target.closest('.btn-add')) { return; }
    var collapse = e.target.closest('.module-collapse');
    if (collapse && !e.target.closest('.module-title')) {
      var card = collapse.closest('.module-card');
      if (card) { card.classList.toggle('collapsed'); }
    }
  });

  // checkbox
  grid.addEventListener('change', function(e){
    var target = e.target;
    if (target.type!=='checkbox'||!target.classList.contains('item-checkbox')) { return; }
    var item = target.closest('.item'); if (!item) { return; }
    var textEl = item.querySelector('.item-text');
    if (textEl) { if (target.checked) { textEl.classList.add('done'); } else { textEl.classList.remove('done'); } }
    item.setAttribute('data-status', target.checked?'done':'open');
    if (activeFilter!=='all') { applyFilter(); }
    vscode.postMessage({command:'toggleItem', rawLine:decodeURIComponent(item.getAttribute('data-raw')||'')});
  });

  // delete buttons (delegation on grid + module-wrap)
  function handleDelete(e) {
    var btn = e.target.closest('.btn-delete');
    if (!btn) { return; }
    e.stopPropagation();
    var raw    = btn.getAttribute('data-raw');
    var modRaw = btn.getAttribute('data-mod-raw');
    var subRaw = btn.getAttribute('data-sub-raw');
    if (raw)    { vscode.postMessage({command:'deleteItem',     rawLine:decodeURIComponent(raw)}); }
    else if (modRaw) { vscode.postMessage({command:'deleteModule',  moduleRawLine:decodeURIComponent(modRaw)}); }
    else if (subRaw) { vscode.postMessage({command:'deleteSubSection', subRawLine:decodeURIComponent(subRaw)}); }
  }
  grid.addEventListener('click', handleDelete);

  // add buttons
  grid.addEventListener('click', function(e){
    if (e.target.closest('.inline-edit-input')) { return; }
    var btn = e.target.closest('.btn-add');
    if (!btn) { return; }
    e.stopPropagation();

    if (btn.classList.contains('btn-add-item')) {
      var parentRaw = decodeURIComponent(btn.getAttribute('data-parent-raw')||'');
      showAddInput(btn.parentElement, 'New item text…', function(text){
        vscode.postMessage({command:'addItem', parentRawLine:parentRaw, text:text});
      });
      return;
    }
    if (btn.classList.contains('btn-add-subsection')) {
      var modRaw2 = decodeURIComponent(btn.getAttribute('data-mod-raw')||'');
      showAddInput(btn.parentElement, 'New sub-section title…', function(text){
        vscode.postMessage({command:'addSubSection', moduleRawLine:modRaw2, title:text});
      });
      return;
    }
  });

  // add module button
  var addModBtn = document.querySelector('.btn-add-module');
  if (addModBtn) {
    addModBtn.addEventListener('click', function(){
      showAddInput(addModBtn.parentElement, 'New module name…', function(text){
        vscode.postMessage({command:'addModule', title:text});
      });
    });
  }

  // inline edit
  initInlineEdit(grid);

  // drag handlers
  initItemReorder(grid);
  initModuleReorder(grid);
  document.querySelectorAll('.module-body').forEach(function(body){
    var card = body.closest('.module-card');
    var titleEl = card ? card.querySelector('.module-title') : null;
    var modRaw3 = titleEl ? decodeURIComponent(titleEl.getAttribute('data-raw')||'') : '';
    initSubSectionReorder(body, modRaw3);
  });

  // header buttons
  var useActiveBtn = document.getElementById('useActiveBtn');
  if (useActiveBtn) { useActiveBtn.addEventListener('click', function(){ vscode.postMessage({command:'useActiveFile'}); }); }
  var changeBtn = document.getElementById('changeFileBtn');
  if (changeBtn) { changeBtn.addEventListener('click', function(){ vscode.postMessage({command:'pickFile'}); }); }
  var clearBtn = document.getElementById('clearFileBtn');
  if (clearBtn) { clearBtn.addEventListener('click', function(){ vscode.postMessage({command:'clearFile'}); }); }
  var openBtn = document.getElementById('openFileBtn');
  if (openBtn) { openBtn.addEventListener('click', function(){ vscode.postMessage({command:'openFile'}); }); }

  // search
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', function(e){ searchQuery=e.target.value; saveState(); applyFilter(); });
  }

  // filter buttons
  document.querySelectorAll('.filter-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active'); activeFilter=btn.getAttribute('data-filter')||'all'; saveState(); applyFilter();
    });
  });

  // sort
  if (sortSelect) {
    sortSelect.addEventListener('change', function(){ currentSort=sortSelect.value; saveState(); applyDomSort(currentSort); applyFilter(); });
  }
}
`;
