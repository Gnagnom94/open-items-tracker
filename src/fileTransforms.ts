// ── Pure line transformations ────────────────────────────────────────────────
// Zero I/O — each function receives lines and returns modified lines.
// Used by both the fs-based fileEditor and the TextDocument-based documentEditor.

/** A pure transformation: receives lines, returns modified lines. */
export type LinesTransform = (lines: string[]) => string[];

// ── helpers ───────────────────────────────────────────────────────────────────

/** Index of next `## ` after startIdx, or lines.length */
function nextModuleIdx(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { return i; }
  }
  return lines.length;
}

/** Index of next `## ` or `### ` after startIdx, or lines.length */
function nextSectionIdx(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].startsWith('## ') || lines[i].startsWith('### ')) { return i; }
  }
  return lines.length;
}

function extractFromDone(rawLine: string): { text: string; note?: string } {
  const textMatch = rawLine.match(/~~\*\*(.+?)\*\*~~/);
  const text = textMatch
    ? textMatch[1]
    : rawLine.slice(5).replace(/~~|\*\*/g, '').replace(/[—–].*$/, '').trim();
  const noteMatch = rawLine.match(/~~\*\*.+?\*\*~~\s*[—–]\s*done\s*\([^)]*\)\.\s*(.*)/i);
  const note = noteMatch && noteMatch[1].trim() ? noteMatch[1].trim() : undefined;
  return { text, note };
}

function extractFromOpen(rawLine: string): { text: string; note?: string } {
  const content = rawLine.slice(5).trim();
  const boldMatch = content.match(/\*\*(.+?)\*\*/);
  const dashIdx = content.indexOf(' — ');
  let text = boldMatch ? boldMatch[1] : dashIdx >= 0 ? content.slice(0, dashIdx) : content;
  text = text.replace(/🔄|🔮/g, '').replace(/\*\*/g, '').trim();
  let note = dashIdx >= 0 ? content.slice(dashIdx + 3).trim() : undefined;
  if (note) { note = note.replace(/🔄|🔮/g, '').trim() || undefined; }
  return { text, note };
}

// ── toggle done/open ──────────────────────────────────────────────────────────

export function toggleItem(rawLine: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }
    const today = new Date().toISOString().slice(0, 10);
    if (rawLine.trimStart().startsWith('- [x]')) {
      const { text, note } = extractFromDone(rawLine);
      result[idx] = note ? `- [ ] **${text}** — ${note}` : `- [ ] **${text}**`;
    } else {
      const { text, note } = extractFromOpen(rawLine);
      result[idx] = note ? `- [x] ~~**${text}**~~ — done (${today}). ${note}` : `- [x] ~~**${text}**~~ — done (${today}).`;
    }
    return result;
  };
}

// ── change item status ────────────────────────────────────────────────────────

export function changeItemStatus(
  rawLine: string,
  newStatus: 'open' | 'partial' | 'future' | 'done'
): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }

    const today = new Date().toISOString().slice(0, 10);
    const isDone = rawLine.trimStart().startsWith('- [x]');
    const { text, note } = isDone ? extractFromDone(rawLine) : extractFromOpen(rawLine);

    let newLine = '';
    if (newStatus === 'done') {
      newLine = note ? `- [x] ~~**${text}**~~ — done (${today}). ${note}` : `- [x] ~~**${text}**~~ — done (${today}).`;
    } else if (newStatus === 'partial') {
      newLine = note ? `- [ ] **${text}** 🔄 — ${note}` : `- [ ] **${text}** 🔄`;
    } else if (newStatus === 'future') {
      newLine = note ? `- [ ] **${text}** 🔮 — ${note}` : `- [ ] **${text}** 🔮`;
    } else {
      newLine = note ? `- [ ] **${text}** — ${note}` : `- [ ] **${text}**`;
    }

    result[idx] = newLine;
    return result;
  };
}

// ── edit item text ────────────────────────────────────────────────────────────

export function editItemText(rawLine: string, newText: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }
    if (rawLine.trimStart().startsWith('- [x]')) {
      result[idx] = rawLine.replace(/~~\*\*.+?\*\*~~/, `~~**${newText}**~~`);
    } else if (/\*\*.+?\*\*/.test(rawLine)) {
      result[idx] = rawLine.replace(/\*\*.+?\*\*/, `**${newText}**`);
    } else {
      const content = rawLine.slice(5).trim();
      const dashIdx = content.indexOf(' — ');
      const rest = dashIdx >= 0 ? content.slice(dashIdx) : '';
      result[idx] = `- [ ] **${newText}**${rest}`;
    }
    return result;
  };
}

// ── edit item note ────────────────────────────────────────────────────────────

export function editItemNote(rawLine: string, newNote: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }
    if (rawLine.trimStart().startsWith('- [x]')) {
      const baseMatch = rawLine.match(/^(.*~~\*\*.+?\*\*~~ — done \(\d{4}-\d{2}-\d{2}\))\./);
      if (baseMatch) {
        result[idx] = newNote ? `${baseMatch[1]}. ${newNote}` : `${baseMatch[1]}.`;
      } else {
        const dashIdx = rawLine.indexOf(' — ');
        const base = dashIdx >= 0 ? rawLine.slice(0, dashIdx) : rawLine;
        result[idx] = newNote ? `${base.trimEnd()} — ${newNote}` : base.trimEnd();
      }
    } else {
      const dashIdx = rawLine.indexOf(' — ');
      const base = dashIdx >= 0 ? rawLine.slice(0, dashIdx) : rawLine;
      result[idx] = newNote ? `${base.trimEnd()} — ${newNote}` : base.trimEnd();
    }
    return result;
  };
}

// ── edit header ───────────────────────────────────────────────────────────────

export function editHeader(rawLine: string, newTitle: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }
    const prefix = rawLine.match(/^(#{1,6}\s+)/)?.[1] ?? '## ';
    result[idx] = prefix + newTitle;
    return result;
  };
}

// ── edit module context ───────────────────────────────────────────────────────

export function editModuleContext(moduleRawLine: string, newContext: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const headerIdx = result.findIndex(l => l === moduleRawLine);
    if (headerIdx === -1) { return result; }
    let contextIdx = -1;
    for (let i = headerIdx + 1; i < result.length; i++) {
      const t = result[i].trim();
      if (!t || t === '---') { continue; }
      if (result[i].startsWith('#') || result[i].startsWith('- [')) { break; }
      contextIdx = i;
      break;
    }
    if (contextIdx === -1) {
      result.splice(headerIdx + 1, 0, '', newContext);
    } else {
      result[contextIdx] = newContext;
    }
    return result;
  };
}

// ── add item ──────────────────────────────────────────────────────────────────

export function addItem(parentRawLine: string, text: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const parentIdx = result.findIndex(l => l === parentRawLine);
    if (parentIdx === -1) { return result; }
    const isModule = parentRawLine.startsWith('## ');
    let insertAfter = parentIdx;
    for (let i = parentIdx + 1; i < result.length; i++) {
      if (result[i].startsWith('## ')) { break; }
      if (!isModule && result[i].startsWith('### ')) { break; }
      if (result[i].startsWith('- [')) { insertAfter = i; }
    }
    result.splice(insertAfter + 1, 0, `- [ ] **${text}**`);
    return result;
  };
}

// ── delete item ───────────────────────────────────────────────────────────────

export function deleteItem(rawLine: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const idx = result.findIndex(l => l === rawLine);
    if (idx === -1) { return result; }
    result.splice(idx, 1);
    return result;
  };
}

// ── add module ────────────────────────────────────────────────────────────────

export function addModule(title: string): LinesTransform {
  return (lines) => {
    // Trim trailing empty lines, then append module
    const result = [...lines];
    while (result.length > 0 && result[result.length - 1].trim() === '') {
      result.pop();
    }
    result.push('', '', '---', '', `## ${title}`, '');
    return result;
  };
}

// ── delete module ─────────────────────────────────────────────────────────────

export function deleteModule(moduleRawLine: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const headerIdx = result.findIndex(l => l === moduleRawLine);
    if (headerIdx === -1) { return result; }
    const endIdx = nextModuleIdx(result, headerIdx + 1);
    result.splice(headerIdx, endIdx - headerIdx);
    return result;
  };
}

// ── add sub-section ───────────────────────────────────────────────────────────

export function addSubSection(moduleRawLine: string, title: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const headerIdx = result.findIndex(l => l === moduleRawLine);
    if (headerIdx === -1) { return result; }
    let insertAt = nextModuleIdx(result, headerIdx + 1);
    while (insertAt > headerIdx + 1 && result[insertAt - 1].trim() === '') { insertAt--; }
    result.splice(insertAt, 0, '', `### ${title}`, '');
    return result;
  };
}

// ── delete sub-section ────────────────────────────────────────────────────────

export function deleteSubSection(subRawLine: string): LinesTransform {
  return (lines) => {
    const result = [...lines];
    const headerIdx = result.findIndex(l => l === subRawLine);
    if (headerIdx === -1) { return result; }
    const endIdx = nextSectionIdx(result, headerIdx + 1);
    result.splice(headerIdx, endIdx - headerIdx);
    return result;
  };
}

// ── reorder items ─────────────────────────────────────────────────────────────

export function reorderItems(oldOrder: string[], newOrder: string[]): LinesTransform {
  return (lines) => {
    if (oldOrder.length !== newOrder.length) { return lines; }
    const result = [...lines];
    const indices = oldOrder.map(ol => result.indexOf(ol)).filter(i => i >= 0);
    if (indices.length !== newOrder.length) { return result; }
    const sortedIndices = [...indices].sort((a, b) => a - b);
    sortedIndices.forEach((fileIdx, posIdx) => { result[fileIdx] = newOrder[posIdx]; });
    return result;
  };
}

// ── reorder modules ───────────────────────────────────────────────────────────

export function reorderModules(oldOrder: string[], newOrder: string[]): LinesTransform {
  return (lines) => {
    if (oldOrder.length !== newOrder.length) { return lines; }
    const firstModIdx = lines.findIndex(l => l.startsWith('## '));
    if (firstModIdx === -1) { return lines; }

    const preamble = lines.slice(0, firstModIdx);
    const blocks = new Map<string, string[]>();
    let curKey: string | null = null;
    let curBlock: string[] = [];

    for (let i = firstModIdx; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        if (curKey !== null) { blocks.set(curKey, curBlock); }
        curKey = lines[i]; curBlock = [lines[i]];
      } else { curBlock.push(lines[i]); }
    }
    if (curKey !== null) { blocks.set(curKey, curBlock); }

    const reordered: string[] = [];
    for (const raw of newOrder) { const b = blocks.get(raw); if (b) { reordered.push(...b); } }
    return [...preamble, ...reordered];
  };
}

// ── reorder sub-sections ──────────────────────────────────────────────────────

export function reorderSubSections(
  moduleRawLine: string, oldOrder: string[], newOrder: string[]
): LinesTransform {
  return (lines) => {
    if (oldOrder.length !== newOrder.length) { return lines; }
    const headerIdx = lines.findIndex(l => l === moduleRawLine);
    if (headerIdx === -1) { return lines; }
    const moduleEnd = nextModuleIdx(lines, headerIdx + 1);

    const before = lines.slice(0, headerIdx);
    const after = lines.slice(moduleEnd);
    const modLines = lines.slice(headerIdx, moduleEnd);

    const preContent: string[] = [modLines[0]];
    const subBlocks = new Map<string, string[]>();
    let curKey: string | null = null;
    let curBlock: string[] = [];

    for (let i = 1; i < modLines.length; i++) {
      if (modLines[i].startsWith('### ')) {
        if (curKey !== null) { subBlocks.set(curKey, curBlock); }
        curKey = modLines[i]; curBlock = [modLines[i]];
      } else {
        if (curKey !== null) { curBlock.push(modLines[i]); }
        else { preContent.push(modLines[i]); }
      }
    }
    if (curKey !== null) { subBlocks.set(curKey, curBlock); }

    const reorderedMod = [...preContent];
    for (const raw of newOrder) { const b = subBlocks.get(raw); if (b) { reorderedMod.push(...b); } }
    return [...before, ...reorderedMod, ...after];
  };
}
