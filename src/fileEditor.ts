import * as fs from 'fs';

// ── helpers ───────────────────────────────────────────────────────────────────

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function writeLines(filePath: string, lines: string[]): void {
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

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

// ── toggle done/open ──────────────────────────────────────────────────────────

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

export function toggleItemInFile(filePath: string, rawLine: string): void {
  const lines = readLines(filePath);
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }
  const today = new Date().toISOString().slice(0, 10);
  if (rawLine.trimStart().startsWith('- [x]')) {
    const { text, note } = extractFromDone(rawLine);
    lines[idx] = note ? `- [ ] **${text}** — ${note}` : `- [ ] **${text}**`;
  } else {
    const { text, note } = extractFromOpen(rawLine);
    lines[idx] = note ? `- [x] ~~**${text}**~~ — done (${today}). ${note}` : `- [x] ~~**${text}**~~ — done (${today}).`;
  }
  writeLines(filePath, lines);
}

// ── edit item text ────────────────────────────────────────────────────────────

export function editItemTextInFile(filePath: string, rawLine: string, newText: string): void {
  const lines = readLines(filePath);
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }
  if (rawLine.trimStart().startsWith('- [x]')) {
    lines[idx] = rawLine.replace(/~~\*\*.+?\*\*~~/, `~~**${newText}**~~`);
  } else if (/\*\*.+?\*\*/.test(rawLine)) {
    lines[idx] = rawLine.replace(/\*\*.+?\*\*/, `**${newText}**`);
  } else {
    const content = rawLine.slice(5).trim();
    const dashIdx = content.indexOf(' — ');
    const rest = dashIdx >= 0 ? content.slice(dashIdx) : '';
    lines[idx] = `- [ ] **${newText}**${rest}`;
  }
  writeLines(filePath, lines);
}

// ── edit item note ────────────────────────────────────────────────────────────

export function editItemNoteInFile(filePath: string, rawLine: string, newNote: string): void {
  const lines = readLines(filePath);
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }
  if (rawLine.trimStart().startsWith('- [x]')) {
    const baseMatch = rawLine.match(/^(.*~~\*\*.+?\*\*~~ — done \(\d{4}-\d{2}-\d{2}\))\./);
    if (baseMatch) {
      lines[idx] = newNote ? `${baseMatch[1]}. ${newNote}` : `${baseMatch[1]}.`;
    } else {
      const dashIdx = rawLine.indexOf(' — ');
      const base = dashIdx >= 0 ? rawLine.slice(0, dashIdx) : rawLine;
      lines[idx] = newNote ? `${base.trimEnd()} — ${newNote}` : base.trimEnd();
    }
  } else {
    const dashIdx = rawLine.indexOf(' — ');
    const base = dashIdx >= 0 ? rawLine.slice(0, dashIdx) : rawLine;
    lines[idx] = newNote ? `${base.trimEnd()} — ${newNote}` : base.trimEnd();
  }
  writeLines(filePath, lines);
}

// ── edit header ───────────────────────────────────────────────────────────────

export function editHeaderInFile(filePath: string, rawLine: string, newTitle: string): void {
  const lines = readLines(filePath);
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }
  const prefix = rawLine.match(/^(#{1,6}\s+)/)?.[1] ?? '## ';
  lines[idx] = prefix + newTitle;
  writeLines(filePath, lines);
}

// ── edit module context ───────────────────────────────────────────────────────

export function editModuleContextInFile(filePath: string, moduleRawLine: string, newContext: string): void {
  const lines = readLines(filePath);
  const headerIdx = lines.findIndex(l => l === moduleRawLine);
  if (headerIdx === -1) { return; }
  let contextIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t === '---') { continue; }
    if (lines[i].startsWith('#') || lines[i].startsWith('- [')) { break; }
    contextIdx = i;
    break;
  }
  if (contextIdx === -1) {
    lines.splice(headerIdx + 1, 0, '', newContext);
  } else {
    lines[contextIdx] = newContext;
  }
  writeLines(filePath, lines);
}

// ── add item ──────────────────────────────────────────────────────────────────

export function addItemToFile(filePath: string, parentRawLine: string, text: string): void {
  const lines = readLines(filePath);
  const parentIdx = lines.findIndex(l => l === parentRawLine);
  if (parentIdx === -1) { return; }
  const isModule = parentRawLine.startsWith('## ');
  let insertAfter = parentIdx;
  for (let i = parentIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { break; }
    if (!isModule && lines[i].startsWith('### ')) { break; }
    if (lines[i].startsWith('- [')) { insertAfter = i; }
  }
  lines.splice(insertAfter + 1, 0, `- [ ] **${text}**`);
  writeLines(filePath, lines);
}

// ── delete item ───────────────────────────────────────────────────────────────

export function deleteItemFromFile(filePath: string, rawLine: string): void {
  const lines = readLines(filePath);
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }
  lines.splice(idx, 1);
  writeLines(filePath, lines);
}

// ── add module ────────────────────────────────────────────────────────────────

export function addModuleToFile(filePath: string, title: string): void {
  const content = fs.readFileSync(filePath, 'utf8').trimEnd();
  fs.writeFileSync(filePath, content + `\n\n---\n\n## ${title}\n\n`, 'utf8');
}

// ── delete module ─────────────────────────────────────────────────────────────

export function deleteModuleFromFile(filePath: string, moduleRawLine: string): void {
  const lines = readLines(filePath);
  const headerIdx = lines.findIndex(l => l === moduleRawLine);
  if (headerIdx === -1) { return; }
  const endIdx = nextModuleIdx(lines, headerIdx + 1);
  lines.splice(headerIdx, endIdx - headerIdx);
  // trim leading blank lines left behind
  while (headerIdx < lines.length && lines[headerIdx].trim() === '') { lines.splice(headerIdx, 1); }
  writeLines(filePath, lines);
}

// ── add sub-section ───────────────────────────────────────────────────────────

export function addSubSectionToFile(filePath: string, moduleRawLine: string, title: string): void {
  const lines = readLines(filePath);
  const headerIdx = lines.findIndex(l => l === moduleRawLine);
  if (headerIdx === -1) { return; }
  let insertAt = nextModuleIdx(lines, headerIdx + 1);
  while (insertAt > headerIdx + 1 && lines[insertAt - 1].trim() === '') { insertAt--; }
  lines.splice(insertAt, 0, '', `### ${title}`, '');
  writeLines(filePath, lines);
}

// ── delete sub-section ────────────────────────────────────────────────────────

export function deleteSubSectionFromFile(filePath: string, subRawLine: string): void {
  const lines = readLines(filePath);
  const headerIdx = lines.findIndex(l => l === subRawLine);
  if (headerIdx === -1) { return; }
  const endIdx = nextSectionIdx(lines, headerIdx + 1);
  lines.splice(headerIdx, endIdx - headerIdx);
  while (headerIdx < lines.length && lines[headerIdx].trim() === '') { lines.splice(headerIdx, 1); }
  writeLines(filePath, lines);
}

// ── reorder items ─────────────────────────────────────────────────────────────

export function reorderItemsInFile(filePath: string, oldOrder: string[], newOrder: string[]): void {
  if (oldOrder.length !== newOrder.length) { return; }
  const lines = readLines(filePath);
  const indices = oldOrder.map(ol => lines.indexOf(ol)).filter(i => i >= 0);
  if (indices.length !== newOrder.length) { return; }
  const sortedIndices = [...indices].sort((a, b) => a - b);
  sortedIndices.forEach((fileIdx, posIdx) => { lines[fileIdx] = newOrder[posIdx]; });
  writeLines(filePath, lines);
}

// ── reorder modules ───────────────────────────────────────────────────────────

export function reorderModulesInFile(filePath: string, oldOrder: string[], newOrder: string[]): void {
  if (oldOrder.length !== newOrder.length) { return; }
  const lines = readLines(filePath);
  const firstModIdx = lines.findIndex(l => l.startsWith('## '));
  if (firstModIdx === -1) { return; }

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
  writeLines(filePath, [...preamble, ...reordered]);
}

// ── reorder sub-sections ──────────────────────────────────────────────────────

export function reorderSubSectionsInFile(
  filePath: string, moduleRawLine: string, oldOrder: string[], newOrder: string[]
): void {
  if (oldOrder.length !== newOrder.length) { return; }
  const lines = readLines(filePath);
  const headerIdx = lines.findIndex(l => l === moduleRawLine);
  if (headerIdx === -1) { return; }
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
  writeLines(filePath, [...before, ...reorderedMod, ...after]);
}
