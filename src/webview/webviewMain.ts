// ── Webview entrypoint ───────────────────────────────────────────────────────
// Bundled by esbuild with platform: 'browser' → dist/webview.js
// Runs inside the VS Code webview iframe — no Node.js, no vscode API (except postMessage).

import type {
  ParsedDocument, Module, OpenItem,
  ExtensionSettings, RenderGitState, HistoryState,
} from '../shared/types';

// ── VS Code API ──────────────────────────────────────────────────────────────

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): Record<string, unknown> | undefined;
  setState(state: Record<string, unknown>): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

// ── Init data (injected by the extension host in a <script> tag) ─────────────

interface InitData {
  data: ParsedDocument;
  settings: ExtensionSettings;
  historyState: HistoryState;
  gitState: RenderGitState;
  isFixedFile?: boolean;
}

const initData: InitData = (window as unknown as { __INIT_DATA__: InitData }).__INIT_DATA__;

// ── State ────────────────────────────────────────────────────────────────────

let activeFilter = 'all';
let searchQuery = '';
let currentSort = 'manual';
let currentSettings: ExtensionSettings | null = null;
let currentHistoryState: HistoryState | null = null;
let currentGitState: RenderGitState | null = null;
let isItemDrag = false;
let isModuleDrag = false;
let isSubDrag = false;

function saveState(): void {
  vscode.setState({ currentSort, activeFilter });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdownLinks(escaped: string): string {
  const linkRe = new RegExp('\\[([^\\]]+)\\]\\(([^)]+)\\)', 'g');
  const lineRe = new RegExp('^L(\\d+)(?:-L?(\\d+))?$');
  return escaped.replace(linkRe, function (_match: string, text: string, target: string) {
    const safeTarget = target.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    let tooltip = safeTarget;
    const hashIdx = safeTarget.indexOf('#');
    if (hashIdx > 0) {
      const filePart = safeTarget.substring(0, hashIdx);
      const fragment = safeTarget.substring(hashIdx + 1);
      const lineMatch = fragment.match(lineRe);
      if (lineMatch) {
        tooltip = filePart + ' \u2014 line' + (lineMatch[2] ? 's ' + lineMatch[1] + '-' + lineMatch[2] : ' ' + lineMatch[1]);
      }
    }
    return '<a href="#" class="item-link" data-link-target="' + esc(safeTarget) + '" title="' + esc(tooltip) + '">' + text + '</a>';
  });
}

// ── Sort ─────────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { open: 0, partial: 1, future: 2, done: 3 };

function sortedItems(items: OpenItem[], strategy: string): OpenItem[] {
  if (strategy === 'manual') { return items.slice(); }
  return items.slice().sort(function (a, b) {
    switch (strategy) {
      case 'status':     return (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);
      case 'alpha':      return a.text.localeCompare(b.text);
      case 'done-last':  return (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0);
      case 'done-first': return (b.status === 'done' ? 1 : 0) - (a.status === 'done' ? 1 : 0);
    }
    return 0;
  });
}

function applyDomSort(strategy: string): void {
  document.querySelectorAll('.items-list').forEach(function (list) {
    const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > .item:not(.git-deleted)'));
    if (items.length <= 1) { return; }
    let sorted: HTMLElement[];
    if (strategy === 'manual') {
      sorted = items.slice().sort(function (a, b) { return (parseInt(a.getAttribute('data-orig-idx') || '0') || 0) - (parseInt(b.getAttribute('data-orig-idx') || '0') || 0); });
    } else {
      sorted = items.slice().sort(function (a, b) {
        const sa = a.getAttribute('data-status') || 'open', sb = b.getAttribute('data-status') || 'open';
        const ta = a.getAttribute('data-text') || '', tb = b.getAttribute('data-text') || '';
        switch (strategy) {
          case 'status':     return (STATUS_ORDER[sa] || 0) - (STATUS_ORDER[sb] || 0);
          case 'alpha':      return ta.localeCompare(tb);
          case 'done-last':  return (sa === 'done' ? 1 : 0) - (sb === 'done' ? 1 : 0);
          case 'done-first': return (sb === 'done' ? 1 : 0) - (sa === 'done' ? 1 : 0);
        }
        return 0;
      });
    }
    // Reinsert in sorted order, keeping git-deleted items at the end
    const deletedItems = Array.from(list.querySelectorAll<HTMLElement>(':scope > .item.git-deleted'));
    sorted.forEach(function (item) { list.appendChild(item); });
    deletedItems.forEach(function (item) { list.appendChild(item); });
  });
  document.querySelectorAll<HTMLElement>('.item:not(.git-deleted)').forEach(function (item) {
    item.removeAttribute('draggable');
  });
}

// ── Filter ───────────────────────────────────────────────────────────────────

function applyFilter(): void {
  const filter = activeFilter, query = searchQuery.toLowerCase();
  document.querySelectorAll<HTMLElement>('.item').forEach(function (item) {
    const status = item.getAttribute('data-status') || '';
    if (item.classList.contains('git-deleted')) {
      item.style.display = (filter === 'all' || filter === 'open') && (!query || (item.textContent || '').toLowerCase().indexOf(query) >= 0) ? '' : 'none';
      return;
    }
    if (status === 'done' && currentSettings && !currentSettings.showDoneItems) { item.style.display = 'none'; return; }
    if (status === 'future' && currentSettings && !currentSettings.showFutureItems) { item.style.display = 'none'; return; }
    const text = (item.textContent || '').toLowerCase();
    item.style.display = (filter === 'all' || status === filter) && (!query || text.indexOf(query) >= 0) ? '' : 'none';
  });
  document.querySelectorAll<HTMLElement>('.module-card').forEach(function (card) {
    const items = Array.from(card.querySelectorAll<HTMLElement>('.item'));
    const visible = items.length === 0 || items.some(function (i) { return i.style.display !== 'none'; });
    card.style.display = visible ? '' : 'none';
  });
}

// ── Render item ──────────────────────────────────────────────────────────────

function renderItem(item: OpenItem, origIdx: number): string {
  const gitStatus = (currentGitState && currentGitState.itemStatus[item.rawLine]) || 'clean';
  const gitClass = gitStatus !== 'clean' && currentSettings && currentSettings.gitHighlight ? ' git-' + gitStatus : '';

  const checked = item.status === 'done' ? ' checked' : '';
  const textClass = item.status === 'done' ? 'item-text done' : 'item-text';
  const rawKey = encodeURIComponent(item.rawLine || '');

  const statusSelect =
    '<select class="item-status-select status-' + item.status + '" data-raw="' + rawKey + '">' +
    '<option value="open"' + (item.status === 'open' ? ' selected' : '') + '>Open</option>' +
    '<option value="partial"' + (item.status === 'partial' ? ' selected' : '') + '>🔄 Partial</option>' +
    '<option value="future"' + (item.status === 'future' ? ' selected' : '') + '>🔮 Future</option>' +
    '<option value="done"' + (item.status === 'done' ? ' selected' : '') + '>✅ Done</option>' +
    '</select>';

  const dateHtml = item.date ? '<span class="item-date">' + esc(item.date) + '</span>' : '';
  const noteDiff = (currentSettings && currentSettings.gitHighlight && currentSettings.gitShowInlineDiff && currentGitState && currentGitState.itemNoteDiffHtml[item.rawLine]);
  let noteHtml = '';
  if (noteDiff) {
    noteHtml = '<div class="item-note" data-raw="' + rawKey + '" title="Click to edit">' + noteDiff + '</div>';
  } else if (item.note) {
    noteHtml = '<div class="item-note" data-raw="' + rawKey + '" data-raw-note="' + esc(item.note) + '" title="Click to edit">' + renderMarkdownLinks(esc(item.note)) + '</div>';
  }

  const textHtml = (currentSettings && currentSettings.gitHighlight && currentSettings.gitShowInlineDiff && currentGitState && currentGitState.itemDiffHtml[item.rawLine]) || renderMarkdownLinks(esc(item.text));

  return (
    '<li class="item' + gitClass + '" data-status="' + item.status + '" data-raw="' + rawKey + '" data-text="' + esc(item.text) + '" data-orig-idx="' + origIdx + '">' +
    '<span class="drag-handle" title="Drag to reorder">&#8942;</span>' +
    '<input type="checkbox" class="item-checkbox"' + checked + '>' +
    statusSelect +
    '<div class="item-body">' +
    '<div class="' + textClass + '">' +
    '<span class="item-text-content" title="Click to edit">' + textHtml + '</span>' +
    dateHtml +
    '</div>' +
    noteHtml +
    '</div>' +
    '<button class="btn-delete" data-raw="' + rawKey + '" title="Delete item">&#10005;</button>' +
    '</li>'
  );
}

function renderItems(items: OpenItem[], parentRaw: string): string {
  const sorted = sortedItems(items, currentSort);
  let html = '<ul class="items-list">';
  if (sorted.length > 0) {
    html += sorted.map(function (item, i) { return renderItem(item, i); }).join('');
  }

  // Render deleted items (Git diff)
  if (currentSettings && currentSettings.gitHighlight && currentGitState && currentGitState.deletedItems && currentGitState.deletedItems[parentRaw]) {
    const deletedList = currentGitState.deletedItems[parentRaw];
    html += deletedList.map(function (delItem) {
      return (
        '<li class="item git-deleted" data-status="deleted">' +
        '<span class="git-deleted-indicator" title="Deleted in Git">&#10005;</span>' +
        '<div class="item-body">' +
        '<div class="item-text done" style="color: var(--vscode-errorForeground, #f48771);">' +
        '<del class="git-diff-del">' + esc(delItem.text) + '</del>' +
        (delItem.note ? '<div class="item-note"><del class="git-diff-del">' + esc(delItem.note) + '</del></div>' : '') +
        '</div>' +
        '</div>' +
        '</li>'
      );
    }).join('');
  }

  html += '</ul>';
  html += '<button class="btn-add btn-add-item" data-parent-raw="' + encodeURIComponent(parentRaw) + '">+ Add item</button>';
  return html;
}

// ── Render module card ───────────────────────────────────────────────────────

function getModuleStats(mod: Module): { total: number; done: number } {
  const all = mod.items.concat(mod.subSections.reduce(function (a: OpenItem[], s) { return a.concat(s.items); }, []));
  return { total: all.length, done: all.filter(function (i) { return i.status === 'done'; }).length };
}

function renderModuleCard(mod: Module, idx: number, settings: ExtensionSettings): string {
  const ms = getModuleStats(mod);
  const pct = ms.total > 0 ? Math.round(ms.done / ms.total * 100) : 0;
  const collapsed = settings.collapseByDefault ? ' collapsed' : '';
  const modRawKey = encodeURIComponent(mod.rawLine || '');

  const subHtml = mod.subSections.map(function (sub) {
    const subRawKey = encodeURIComponent(sub.rawLine || '');
    return (
      '<div class="subsection" data-sub-raw="' + subRawKey + '">' +
      '<div class="subsection-header">' +
      '<span class="sub-drag-handle" title="Drag to reorder">&#8942;</span>' +
      '<div class="subsection-title" data-raw="' + subRawKey + '" title="Click to edit">' + esc(sub.title) + '</div>' +
      '<button class="btn-delete" data-sub-raw="' + subRawKey + '" title="Delete sub-section">&#10005;</button>' +
      '</div>' +
      renderItems(sub.items, sub.rawLine || '') +
      '</div>'
    );
  }).join('');

  return (
    '<div class="module-card' + collapsed + '" data-mod-idx="' + idx + '">' +
    '<div class="module-header">' +
    '<span class="module-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>' +
    '<div class="module-collapse">' +
    '<div class="module-title" data-raw="' + modRawKey + '" title="Click to edit">' + esc(mod.title) + '</div>' +
    '<div class="module-meta">' +
    '<div class="mini-progress"><div class="mini-progress-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="module-count">' + ms.done + '/' + ms.total + '</span>' +
    '<span class="chevron">&#9660;</span>' +
    '</div>' +
    '</div>' +
    '<button class="btn-delete" data-mod-raw="' + modRawKey + '" title="Delete module">&#10005;</button>' +
    '</div>' +
    '<div class="module-body">' +
    (mod.context
      ? '<div class="module-context" data-mod-raw="' + modRawKey + '" title="Click to edit">' + esc(mod.context) + '</div>'
      : '') +
    renderItems(mod.items, mod.rawLine || '') +
    subHtml +
    '<button class="btn-add btn-add-subsection" data-mod-raw="' + modRawKey + '">+ Add sub-section</button>' +
    '</div>' +
    '</div>'
  );
}

// ── Inline add input ─────────────────────────────────────────────────────────

function showAddInput(container: HTMLElement, placeholder: string, onConfirm: (text: string) => void): void {
  const existing = container.querySelector('.add-input-wrapper');
  if (existing) { existing.remove(); return; }
  const wrapper = document.createElement('div');
  wrapper.className = 'add-input-wrapper';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'inline-edit-input'; input.placeholder = placeholder;
  wrapper.appendChild(input); container.appendChild(wrapper); input.focus();
  let done = false;
  function finish(save: boolean): void {
    if (done) { return; } done = true;
    const text = input.value.trim();
    wrapper.remove();
    if (save && text) { onConfirm(text); }
  }
  input.addEventListener('blur', function () { finish(false); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { finish(false); }
  });
}

// ── Inline text edit ─────────────────────────────────────────────────────────

function startInlineEdit(el: HTMLElement, originalText: string, onSave: (text: string) => void, renderFn?: (text: string) => string): void {
  const input = document.createElement('textarea');
  input.className = 'inline-edit-input'; input.value = originalText; input.rows = 1;
  el.replaceChildren(input); input.focus(); input.select();
  let saved = false;
  function restore(text: string): void {
    if (renderFn) { el.innerHTML = renderFn(text); }
    else { el.textContent = text; }
  }
  function save(): void {
    if (saved) { return; } saved = true;
    const newText = input.value.trim();
    if (newText && newText !== originalText) { onSave(newText); restore(newText); }
    else { restore(originalText); }
  }
  function cancel(): void { if (saved) { return; } saved = true; restore(originalText); }
  input.addEventListener('blur', save);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', save); cancel(); }
  });
}

function initInlineEdit(root: HTMLElement): void {
  root.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    if (target.closest('.inline-edit-input')) { return; }
    const link = target.closest('.item-link') as HTMLElement | null;
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({ command: 'openLink', target: link.getAttribute('data-link-target') });
      return;
    }
    e.stopPropagation();
    const tc = target.closest('.item-text-content') as HTMLElement | null;
    if (tc) {
      const item = tc.closest('.item') as HTMLElement;
      if (item.classList.contains('git-deleted')) { return; }
      const rawLine = decodeURIComponent(item.getAttribute('data-raw') || '');
      const origText = item.getAttribute('data-text') || tc.textContent!.trim();
      startInlineEdit(tc, origText, function (t) { item.setAttribute('data-text', t); vscode.postMessage({ command: 'editItem', rawLine: rawLine, newText: t }); }, function (t) { return renderMarkdownLinks(esc(t)); });
      return;
    }
    const mt = target.closest('.module-title') as HTMLElement | null;
    if (mt) {
      const raw = decodeURIComponent(mt.getAttribute('data-raw') || '');
      startInlineEdit(mt, mt.textContent!.trim(), function (t) { vscode.postMessage({ command: 'editHeader', rawLine: raw, newText: t }); });
      return;
    }
    const st = target.closest('.subsection-title') as HTMLElement | null;
    if (st) {
      const raw2 = decodeURIComponent(st.getAttribute('data-raw') || '');
      startInlineEdit(st, st.textContent!.trim(), function (t) { vscode.postMessage({ command: 'editHeader', rawLine: raw2, newText: t }); });
      return;
    }
    const ne = target.closest('.item-note') as HTMLElement | null;
    if (ne) {
      const item2 = ne.closest('.item') as HTMLElement | null;
      if (item2 && item2.classList.contains('git-deleted')) { return; }
      const raw3 = decodeURIComponent(ne.getAttribute('data-raw') || '');
      const rawNote = ne.getAttribute('data-raw-note') || ne.textContent!.trim();
      startInlineEdit(ne, rawNote, function (t) { ne.setAttribute('data-raw-note', t); vscode.postMessage({ command: 'editItemNote', rawLine: raw3, newNote: t }); }, function (t) { return renderMarkdownLinks(esc(t)); });
      return;
    }
    const ctx = target.closest('.module-context') as HTMLElement | null;
    if (ctx) {
      const mraw = decodeURIComponent(ctx.getAttribute('data-mod-raw') || '');
      startInlineEdit(ctx, ctx.textContent!.trim(), function (t) { vscode.postMessage({ command: 'editModuleContext', moduleRawLine: mraw, newContext: t }); });
      return;
    }
  });
}

// ── Item drag-to-reorder ─────────────────────────────────────────────────────

function initItemReorder(root: HTMLElement): void {
  let dragging: HTMLElement | null = null, dragOverEl: HTMLElement | null = null, insertBefore = true;
  root.addEventListener('mousedown', function (e) {
    const target = e.target as HTMLElement;
    if (target.closest('.module-drag-handle') || target.closest('.sub-drag-handle')) { return; }
    if (currentSort !== 'manual') { return; }
    const handle = target.closest('.drag-handle');
    if (handle) {
      const item = handle.closest('.item') as HTMLElement | null;
      if (item && !item.classList.contains('git-deleted')) {
        item.setAttribute('draggable', 'true');
      }
    }
  });
  root.addEventListener('dragstart', function (e) {
    const item = (e.target as HTMLElement).closest('.item[draggable="true"]') as HTMLElement | null;
    if (!item || item.classList.contains('git-deleted')) { return; }
    if (isModuleDrag || isSubDrag) { return; }
    isItemDrag = true; dragging = item; e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', '');
    setTimeout(function () { item.classList.add('dragging'); }, 0);
  });
  root.addEventListener('dragover', function (e) {
    if (!isItemDrag) { return; }
    const item = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (!item || item === dragging || item.classList.contains('git-deleted')) { return; }
    e.preventDefault(); e.stopPropagation();
    root.querySelectorAll('.item').forEach(function (i) { i.classList.remove('drag-over-top', 'drag-over-bottom'); });
    const rect = item.getBoundingClientRect(); insertBefore = e.clientY < rect.top + rect.height / 2;
    item.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom'); dragOverEl = item;
  });
  root.addEventListener('dragleave', function (e) {
    if (!root.contains(e.relatedTarget as Node)) { root.querySelectorAll('.item').forEach(function (i) { i.classList.remove('drag-over-top', 'drag-over-bottom'); }); dragOverEl = null; }
  });
  root.addEventListener('drop', function (e) {
    if (!isItemDrag) { return; }
    e.preventDefault(); e.stopPropagation();
    isItemDrag = false;
    if (!dragging || !dragOverEl) {
      root.querySelectorAll('.item').forEach(function (i) {
        i.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        (i as HTMLElement).removeAttribute('draggable');
      });
      dragging = null; dragOverEl = null; return;
    }
    const list = dragging.closest('.items-list'), tlist = dragOverEl.closest('.items-list');
    if (!list || list !== tlist) {
      root.querySelectorAll('.item').forEach(function (i) {
        i.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        (i as HTMLElement).removeAttribute('draggable');
      });
      dragging = null; dragOverEl = null; return;
    }
    const oldOrder = Array.from(list.querySelectorAll<HTMLElement>(':scope > .item:not(.git-deleted)')).map(function (i) { return decodeURIComponent(i.getAttribute('data-raw') || ''); });
    if (insertBefore) { list.insertBefore(dragging, dragOverEl); } else { list.insertBefore(dragging, dragOverEl.nextSibling); }
    const newOrder = Array.from(list.querySelectorAll<HTMLElement>(':scope > .item:not(.git-deleted)')).map(function (i) { return decodeURIComponent(i.getAttribute('data-raw') || ''); });
    vscode.postMessage({ command: 'reorderItems', oldOrder: oldOrder, newOrder: newOrder });
    root.querySelectorAll('.item').forEach(function (i) {
      i.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
      (i as HTMLElement).removeAttribute('draggable');
    });
    dragging = null; dragOverEl = null;
  });
  root.addEventListener('dragend', function () {
    isItemDrag = false;
    if (dragging) {
      dragging.classList.remove('dragging');
      dragging.removeAttribute('draggable');
    }
    root.querySelectorAll('.item').forEach(function (i) {
      i.classList.remove('drag-over-top', 'drag-over-bottom');
      (i as HTMLElement).removeAttribute('draggable');
    });
    dragging = null; dragOverEl = null;
  });
}

// ── Module drag-to-reorder ───────────────────────────────────────────────────

function initModuleReorder(grid: HTMLElement): void {
  let dragging: HTMLElement | null = null, dragOver: HTMLElement | null = null, insertBefore = true;
  grid.addEventListener('mousedown', function (e) {
    const handle = (e.target as HTMLElement).closest('.module-drag-handle');
    if (handle) { const card = handle.closest('.module-card') as HTMLElement | null; if (card) { card.setAttribute('draggable', 'true'); } }
  });
  grid.addEventListener('dragstart', function (e) {
    const card = (e.target as HTMLElement).closest('.module-card[draggable="true"]') as HTMLElement | null;
    if (!card) { return; }
    isModuleDrag = true; isItemDrag = false; dragging = card; e.dataTransfer!.effectAllowed = 'move';
    setTimeout(function () { card.classList.add('mod-dragging'); }, 0);
  });
  grid.addEventListener('dragover', function (e) {
    if (!isModuleDrag) { return; }
    const card = (e.target as HTMLElement).closest('.module-card') as HTMLElement | null;
    if (!card || card === dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    grid.querySelectorAll('.module-card').forEach(function (c) { c.classList.remove('mod-drag-over-top', 'mod-drag-over-bottom'); });
    const rect = card.getBoundingClientRect(); insertBefore = e.clientY < rect.top + rect.height / 2;
    card.classList.add(insertBefore ? 'mod-drag-over-top' : 'mod-drag-over-bottom'); dragOver = card;
  });
  grid.addEventListener('dragleave', function (e) {
    if (!grid.contains(e.relatedTarget as Node)) {
      grid.querySelectorAll('.module-card').forEach(function (c) { c.classList.remove('mod-drag-over-top', 'mod-drag-over-bottom'); });
      dragOver = null;
    }
  });
  grid.addEventListener('drop', function (e) {
    if (!isModuleDrag) { return; }
    e.stopPropagation();
    grid.querySelectorAll('.module-card').forEach(function (c) { c.classList.remove('mod-dragging', 'mod-drag-over-top', 'mod-drag-over-bottom'); (c as HTMLElement).removeAttribute('draggable'); });
    isModuleDrag = false;
    if (!dragging || !dragOver) { dragging = null; dragOver = null; return; }
    const oldOrder = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .module-card')).map(function (c) { return decodeURIComponent((c.querySelector('.module-title') as HTMLElement | null)?.getAttribute('data-raw') || ''); });
    if (insertBefore) { grid.insertBefore(dragging, dragOver); } else { grid.insertBefore(dragging, dragOver.nextSibling); }
    const newOrder = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .module-card')).map(function (c) { return decodeURIComponent((c.querySelector('.module-title') as HTMLElement | null)?.getAttribute('data-raw') || ''); });
    vscode.postMessage({ command: 'reorderModules', oldOrder: oldOrder, newOrder: newOrder });
    dragging = null; dragOver = null;
  });
  grid.addEventListener('dragend', function () {
    isModuleDrag = false;
    grid.querySelectorAll('.module-card').forEach(function (c) { c.classList.remove('mod-dragging', 'mod-drag-over-top', 'mod-drag-over-bottom'); (c as HTMLElement).removeAttribute('draggable'); });
    dragging = null; dragOver = null;
  });
}

// ── Subsection drag-to-reorder ───────────────────────────────────────────────

function initSubSectionReorder(body: HTMLElement, moduleRaw: string): void {
  let dragging: HTMLElement | null = null, dragOver: HTMLElement | null = null, insertBefore = true;
  body.addEventListener('mousedown', function (e) {
    const handle = (e.target as HTMLElement).closest('.sub-drag-handle');
    if (handle) { const sub = handle.closest('.subsection') as HTMLElement | null; if (sub) { sub.setAttribute('draggable', 'true'); } }
  });
  body.addEventListener('dragstart', function (e) {
    const sub = (e.target as HTMLElement).closest('.subsection[draggable="true"]') as HTMLElement | null;
    if (!sub) { return; }
    isSubDrag = true; isItemDrag = false; isModuleDrag = false; dragging = sub; e.dataTransfer!.effectAllowed = 'move';
    setTimeout(function () { sub.classList.add('sub-dragging'); }, 0);
  });
  body.addEventListener('dragover', function (e) {
    if (!isSubDrag) { return; }
    const sub = (e.target as HTMLElement).closest('.subsection') as HTMLElement | null;
    if (!sub || sub === dragging) { return; }
    e.preventDefault(); e.stopPropagation();
    body.querySelectorAll('.subsection').forEach(function (s) { s.classList.remove('sub-drag-over-top', 'sub-drag-over-bottom'); });
    const rect = sub.getBoundingClientRect(); insertBefore = e.clientY < rect.top + rect.height / 2;
    sub.classList.add(insertBefore ? 'sub-drag-over-top' : 'sub-drag-over-bottom'); dragOver = sub;
  });
  body.addEventListener('dragleave', function (e) {
    if (!body.contains(e.relatedTarget as Node)) {
      body.querySelectorAll('.subsection').forEach(function (s) { s.classList.remove('sub-drag-over-top', 'sub-drag-over-bottom'); });
      dragOver = null;
    }
  });
  body.addEventListener('drop', function (e) {
    if (!isSubDrag) { return; }
    e.stopPropagation();
    body.querySelectorAll('.subsection').forEach(function (s) { s.classList.remove('sub-dragging', 'sub-drag-over-top', 'sub-drag-over-bottom'); (s as HTMLElement).removeAttribute('draggable'); });
    isSubDrag = false;
    if (!dragging || !dragOver) { dragging = null; dragOver = null; return; }
    const oldOrder = Array.from(body.querySelectorAll<HTMLElement>('.subsection')).map(function (s) { return decodeURIComponent(s.getAttribute('data-sub-raw') || ''); });
    if (insertBefore) { body.insertBefore(dragging, dragOver); } else { body.insertBefore(dragging, dragOver.nextSibling); }
    const newOrder = Array.from(body.querySelectorAll<HTMLElement>('.subsection')).map(function (s) { return decodeURIComponent(s.getAttribute('data-sub-raw') || ''); });
    vscode.postMessage({ command: 'reorderSubSections', moduleRawLine: moduleRaw, oldOrder: oldOrder, newOrder: newOrder });
    dragging = null; dragOver = null;
  });
  body.addEventListener('dragend', function () {
    isSubDrag = false;
    body.querySelectorAll('.subsection').forEach(function (s) { s.classList.remove('sub-dragging', 'sub-drag-over-top', 'sub-drag-over-bottom'); (s as HTMLElement).removeAttribute('draggable'); });
    dragging = null; dragOver = null;
  });
}

// ── Full-body file-drop overlay ──────────────────────────────────────────────

function initDragDrop(): void {
  const overlay = document.getElementById('dropOverlay');
  if (!overlay) { return; }
  let timer: ReturnType<typeof setTimeout> | null = null;
  document.addEventListener('dragover', function (e) {
    if (isItemDrag || isModuleDrag || isSubDrag) { return; }
    e.preventDefault(); overlay.classList.remove('hidden');
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(function () { overlay.classList.add('hidden'); }, 200);
  });
  document.addEventListener('drop', function (e) {
    if (isItemDrag || isModuleDrag || isSubDrag) { return; }
    e.preventDefault(); if (timer) { clearTimeout(timer); } overlay.classList.add('hidden');
    const uri = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
    if (uri) { handleDropUri(uri); }
  });
}

function handleDropUri(uri: string): void {
  if (!uri) { return; }
  uri = uri.split('\n')[0].trim();
  vscode.postMessage({ command: 'dropFile', uri: uri });
}

function initDropZone(zone: HTMLElement): void {
  zone.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function (e) { if (!zone.contains(e.relatedTarget as Node)) { zone.classList.remove('dragover'); } });
  zone.addEventListener('drop', function (e) {
    e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover');
    const uri = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
    if (uri) { handleDropUri(uri); }
  });
}

// ── Main render ──────────────────────────────────────────────────────────────

function renderApp(data: ParsedDocument, settings: ExtensionSettings, historyState: HistoryState, gitState: RenderGitState): void {
  currentSettings = settings;
  currentHistoryState = historyState;
  currentGitState = gitState;

  const state = vscode.getState() || {};
  currentSort = (state.currentSort as string) || settings.defaultSort;
  activeFilter = (state.activeFilter as string) || 'all';

  const app = document.getElementById('app');
  if (!app) { return; }

  // Apply font size from settings
  document.body.style.fontSize = settings.fontSize + 'px';

  const s = data.stats;
  const pct = s.total > 0 ? Math.round(s.done / s.total * 100) : 0;
  let html = '';

  // Sticky topbar wrapper
  html += '<div class="topbar">';

  // header
  html += '<div class="header"><div class="header-row"><h1>Open Items</h1><div class="header-actions">';
  html += '<button class="btn-icon" id="skillStatusBtn" title="AI Skill Status &amp; Install">&#x1F9E9;</button>';
  if (!initData.isFixedFile) {
    html += '<button class="btn-icon" id="useActiveBtn" title="Use active editor file">&#8601;</button>';
    html += '<button class="btn-icon" id="changeFileBtn" title="Choose file">&hellip;</button>';
    html += '<button class="btn-icon btn-icon-danger" id="clearFileBtn" title="Clear">&#128465;</button>';
  }

  // Undo/Redo buttons
  const undoDisabled = !currentHistoryState || !currentHistoryState.hasUndo ? ' disabled' : '';
  const redoDisabled = !currentHistoryState || !currentHistoryState.hasRedo ? ' disabled' : '';
  html += '<button class="btn-icon" id="undoBtn" title="Undo (Ctrl+Z)"' + undoDisabled + '>&#8630;</button>';
  html += '<button class="btn-icon" id="redoBtn" title="Redo (Ctrl+Shift+Z)"' + redoDisabled + '>&#8631;</button>';

  // Font size controls
  html += '<span class="font-size-controls">';
  html += '<button class="btn-icon btn-font" id="fontDecBtn" title="Decrease font size">A&#8722;</button>';
  html += '<button class="btn-icon btn-font" id="fontResetBtn" title="Reset font size">A</button>';
  html += '<button class="btn-icon btn-font" id="fontIncBtn" title="Increase font size">A+</button>';
  html += '</span>';

  if (data.filePath) { html += '<button class="btn-secondary" id="openFileBtn">Raw &#8599;</button>'; }
  html += '</div></div>';
  if (data.lastUpdated) { html += '<div class="last-updated">Last updated: ' + esc(data.lastUpdated) + '</div>'; }
  html += '</div>';

  // stats
  html += '<div class="stats">';
  html += '<div class="stat stat-total"><span class="stat-count">' + s.total + '</span><span class="stat-label">Total</span></div>';
  html += '<div class="stat stat-done"><span class="stat-count done-color">' + s.done + '</span><span class="stat-label">Done</span></div>';
  html += '<div class="stat stat-partial"><span class="stat-count partial-color">' + s.partial + '</span><span class="stat-label">Partial</span></div>';
  html += '<div class="stat stat-open"><span class="stat-count">' + s.open + '</span><span class="stat-label">Open</span></div>';
  if (s.future > 0) { html += '<div class="stat stat-future"><span class="stat-count future-color">' + s.future + '</span><span class="stat-label">Future</span></div>'; }
  html += '<div class="stat stat-pct"><span class="stat-count pct-color">' + pct + '%</span><span class="stat-label">Complete</span></div>';
  html += '</div>';
  html += '<div class="progress-wrap"><div class="progress-bar" style="width:' + pct + '%"></div></div>';

  // Git Status Panel
  if (settings.gitIntegration && currentGitState && currentGitState.isRepo && currentGitState.status !== 'error') {
    const gitClass = currentGitState.status === 'clean' ? 'git-clean' : 'git-dirty';
    const gitText = currentGitState.status === 'clean' ? 'Git: Clean' : 'Git: Modified';
    let gitStats = '';
    if (currentGitState.stats.added > 0 || currentGitState.stats.modified > 0 || currentGitState.stats.deleted > 0) {
      gitStats += '<span class="git-stats-badges">';
      if (currentGitState.stats.added > 0) {
        gitStats += '<span class="git-badge git-badge-add">+' + currentGitState.stats.added + '</span>';
      }
      if (currentGitState.stats.modified > 0) {
        gitStats += '<span class="git-badge git-badge-mod">~' + currentGitState.stats.modified + '</span>';
      }
      if (currentGitState.stats.deleted > 0) {
        gitStats += '<span class="git-badge git-badge-del">-' + currentGitState.stats.deleted + '</span>';
      }
      gitStats += '</span>';
    }

    html += (
      '<div class="git-status-panel ' + gitClass + '">' +
      '<div class="git-info">' +
      '<span class="git-icon">&#9670; git</span>' +
      '<span class="git-status-text">' + gitText + '</span>' +
      gitStats +
      '</div>' +
      '</div>'
    );
  }

  // controls
  html += '<div class="controls"><div class="controls-top">';
  html += '<input type="text" id="searchInput" class="search-input" placeholder="Filter items..." autocomplete="off" />';
  html += '<select id="sortSelect" class="sort-select">';
  html += '<option value="manual">As in file</option><option value="status">By status</option>';
  html += '<option value="alpha">Alphabetical</option><option value="done-last">Done last</option><option value="done-first">Done first</option>';
  html += '</select></div><div class="filters">';
  html += '<button class="filter-btn" data-filter="all">All (' + s.total + ')</button>';
  html += '<button class="filter-btn" data-filter="open">&#9744; Open (' + s.open + ')</button>';
  html += '<button class="filter-btn" data-filter="partial">&#128260; Partial (' + s.partial + ')</button>';
  if (settings.showDoneItems) { html += '<button class="filter-btn" data-filter="done">&#9989; Done (' + s.done + ')</button>'; }
  if (settings.showFutureItems && s.future > 0) { html += '<button class="filter-btn" data-filter="future">&#128302; Future (' + s.future + ')</button>'; }
  html += '</div></div>';

  // End topbar
  html += '</div>';

  // modules grid
  html += '<div class="modules" id="modulesGrid">';
  data.modules.forEach(function (mod, idx) { html += renderModuleCard(mod, idx, settings); });
  html += '</div>';
  html += '<div class="btn-add-module-wrap"><button class="btn-add btn-add-module">+ Add module</button></div>';

  app.innerHTML = html;

  // restore sort + filter
  const sortSelect = document.getElementById('sortSelect') as HTMLSelectElement | null;
  if (sortSelect) { sortSelect.value = currentSort; }
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === activeFilter);
  });
  if (currentSort !== 'manual') { applyDomSort(currentSort); }
  applyFilter();

  const grid = document.getElementById('modulesGrid')!;

  // accordion (click on module-collapse only, not title or delete)
  grid.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    if (target.closest('.inline-edit-input')) { return; }
    if (target.closest('.btn-delete') || target.closest('.btn-add')) { return; }
    const collapse = target.closest('.module-collapse');
    if (collapse && !target.closest('.module-title')) {
      const card = collapse.closest('.module-card');
      if (card) { card.classList.toggle('collapsed'); }
    }
  });

  // checkbox
  grid.addEventListener('change', function (e) {
    const target = e.target as HTMLInputElement;
    if (target.type !== 'checkbox' || !target.classList.contains('item-checkbox')) { return; }
    const item = target.closest('.item') as HTMLElement | null; if (!item) { return; }
    const textEl = item.querySelector('.item-text');
    if (textEl) { if (target.checked) { textEl.classList.add('done'); } else { textEl.classList.remove('done'); } }
    item.setAttribute('data-status', target.checked ? 'done' : 'open');
    if (activeFilter !== 'all') { applyFilter(); }
    vscode.postMessage({ command: 'toggleItem', rawLine: decodeURIComponent(item.getAttribute('data-raw') || '') });
  });

  // status select
  grid.addEventListener('change', function (e) {
    const target = e.target as HTMLSelectElement;
    if (target.tagName === 'SELECT' && target.classList.contains('item-status-select')) {
      const item = target.closest('.item') as HTMLElement | null; if (!item) { return; }
      const rawLine = decodeURIComponent(target.getAttribute('data-raw') || '');
      const newStatus = target.value;
      vscode.postMessage({ command: 'changeStatus', rawLine: rawLine, newStatus: newStatus });
    }
  });

  // delete buttons (delegation on grid)
  function handleDelete(e: Event): void {
    const btn = (e.target as HTMLElement).closest('.btn-delete') as HTMLElement | null;
    if (!btn) { return; }
    e.stopPropagation();
    const raw = btn.getAttribute('data-raw');
    const modRaw = btn.getAttribute('data-mod-raw');
    const subRaw = btn.getAttribute('data-sub-raw');
    if (raw) { vscode.postMessage({ command: 'deleteItem', rawLine: decodeURIComponent(raw) }); }
    else if (modRaw) { vscode.postMessage({ command: 'deleteModule', moduleRawLine: decodeURIComponent(modRaw) }); }
    else if (subRaw) { vscode.postMessage({ command: 'deleteSubSection', subRawLine: decodeURIComponent(subRaw) }); }
  }
  grid.addEventListener('click', handleDelete);

  // add buttons
  grid.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;
    if (target.closest('.inline-edit-input')) { return; }
    const btn = target.closest('.btn-add') as HTMLElement | null;
    if (!btn) { return; }
    e.stopPropagation();

    if (btn.classList.contains('btn-add-item')) {
      const parentRaw = decodeURIComponent(btn.getAttribute('data-parent-raw') || '');
      showAddInput(btn.parentElement!, 'New item text…', function (text) {
        vscode.postMessage({ command: 'addItem', parentRawLine: parentRaw, text: text });
      });
      return;
    }
    if (btn.classList.contains('btn-add-subsection')) {
      const modRaw2 = decodeURIComponent(btn.getAttribute('data-mod-raw') || '');
      showAddInput(btn.parentElement!, 'New sub-section title…', function (text) {
        vscode.postMessage({ command: 'addSubSection', moduleRawLine: modRaw2, title: text });
      });
      return;
    }
  });

  // add module button
  const addModBtn = document.querySelector('.btn-add-module') as HTMLElement | null;
  if (addModBtn) {
    addModBtn.addEventListener('click', function () {
      showAddInput(addModBtn.parentElement!, 'New module name…', function (text) {
        vscode.postMessage({ command: 'addModule', title: text });
      });
    });
  }

  // inline edit
  initInlineEdit(grid);

  // drag handlers
  initItemReorder(grid);
  initModuleReorder(grid);
  document.querySelectorAll<HTMLElement>('.module-body').forEach(function (body) {
    const card = body.closest('.module-card');
    const titleEl = card ? card.querySelector('.module-title') as HTMLElement | null : null;
    const modRaw3 = titleEl ? decodeURIComponent(titleEl.getAttribute('data-raw') || '') : '';
    initSubSectionReorder(body, modRaw3);
  });

  // header buttons
  const skillStatusBtn = document.getElementById('skillStatusBtn');
  if (skillStatusBtn) { skillStatusBtn.addEventListener('click', function () { vscode.postMessage({ command: 'skillStatus' }); }); }
  const useActiveBtn = document.getElementById('useActiveBtn');
  if (useActiveBtn) { useActiveBtn.addEventListener('click', function () { vscode.postMessage({ command: 'useActiveFile' }); }); }
  const changeBtn = document.getElementById('changeFileBtn');
  if (changeBtn) { changeBtn.addEventListener('click', function () { vscode.postMessage({ command: 'pickFile' }); }); }
  const clearBtn = document.getElementById('clearFileBtn');
  if (clearBtn) { clearBtn.addEventListener('click', function () { vscode.postMessage({ command: 'clearFile' }); }); }
  const openBtn = document.getElementById('openFileBtn');
  if (openBtn) { openBtn.addEventListener('click', function () { vscode.postMessage({ command: 'openFile' }); }); }

  // Undo/Redo buttons
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) { undoBtn.addEventListener('click', function () { vscode.postMessage({ command: 'undo' }); }); }
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) { redoBtn.addEventListener('click', function () { vscode.postMessage({ command: 'redo' }); }); }

  // Font size buttons
  const fontDecBtn = document.getElementById('fontDecBtn');
  const fontResetBtn = document.getElementById('fontResetBtn');
  const fontIncBtn = document.getElementById('fontIncBtn');
  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', function () {
      const newSize = Math.max(8, (currentSettings?.fontSize || 13) - 1);
      document.body.style.fontSize = newSize + 'px';
      vscode.postMessage({ command: 'setFontSize', size: newSize });
    });
  }
  if (fontResetBtn) {
    fontResetBtn.addEventListener('click', function () {
      const defaultSize = initData.isFixedFile ? 13 : 12;
      document.body.style.fontSize = defaultSize + 'px';
      vscode.postMessage({ command: 'setFontSize', size: defaultSize });
    });
  }
  if (fontIncBtn) {
    fontIncBtn.addEventListener('click', function () {
      const newSize = Math.min(24, (currentSettings?.fontSize || 13) + 1);
      document.body.style.fontSize = newSize + 'px';
      vscode.postMessage({ command: 'setFontSize', size: newSize });
    });
  }

  // search
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener('input', function (e) { searchQuery = (e.target as HTMLInputElement).value; saveState(); applyFilter(); });
  }

  // filter buttons
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active'); activeFilter = btn.getAttribute('data-filter') || 'all'; saveState(); applyFilter();
    });
  });

  // sort
  if (sortSelect) {
    sortSelect.addEventListener('change', function () { currentSort = sortSelect.value; saveState(); applyDomSort(currentSort); applyFilter(); });
  }
}

// ── Window keydown listener (Undo/Redo) ──────────────────────────────────────

window.addEventListener('keydown', function (e) {
  const target = e.target as HTMLElement;
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (isInput) { return; }

  const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
  const isRedo = (e.ctrlKey || e.metaKey) && (
    (e.key.toLowerCase() === 'z' && e.shiftKey) ||
    e.key.toLowerCase() === 'y'
  );

  if (isUndo) {
    e.preventDefault();
    vscode.postMessage({ command: 'undo' });
  } else if (isRedo) {
    e.preventDefault();
    vscode.postMessage({ command: 'redo' });
  }
});

// ── Window mouseup listener to clean up draggable attributes ─────────────────

window.addEventListener('mouseup', function () {
  document.querySelectorAll('.item, .module-card, .subsection').forEach(function (el) {
    (el as HTMLElement).removeAttribute('draggable');
  });
});

// ── Window scroll listener to toggle sticky shadow/border ────────────────────

window.addEventListener('scroll', function () {
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    if (window.scrollY > 0) {
      topbar.classList.add('is-sticky');
    } else {
      topbar.classList.remove('is-sticky');
    }
  }
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

// Check if this is the main app page (has init data) or the no-file/drop-zone page
if (initData) {
  renderApp(initData.data, initData.settings, initData.historyState, initData.gitState);
  if (!initData.isFixedFile) { initDragDrop(); }
} else {
  // No-file page: init the drop zone
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    initDropZone(dropZone);
  }
  // Wire up no-file page buttons
  const useActiveBtn = document.getElementById('useActiveBtn');
  if (useActiveBtn) { useActiveBtn.addEventListener('click', function () { vscode.postMessage({ command: 'useActiveFile' }); }); }
  const pickFileBtn = document.getElementById('pickFileBtn');
  if (pickFileBtn) { pickFileBtn.addEventListener('click', function () { vscode.postMessage({ command: 'pickFile' }); }); }
  const skillStatusBtn = document.getElementById('skillStatusBtn');
  if (skillStatusBtn) { skillStatusBtn.addEventListener('click', function () { vscode.postMessage({ command: 'skillStatus' }); }); }
}
