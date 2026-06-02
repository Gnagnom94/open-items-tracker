import * as fs from 'fs';

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
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }

  const today = new Date().toISOString().slice(0, 10);
  const isDone = rawLine.trimStart().startsWith('- [x]');

  if (isDone) {
    const { text, note } = extractFromDone(rawLine);
    lines[idx] = note ? `- [ ] **${text}** — ${note}` : `- [ ] **${text}**`;
  } else {
    const { text, note } = extractFromOpen(rawLine);
    lines[idx] = note
      ? `- [x] ~~**${text}**~~ — done (${today}). ${note}`
      : `- [x] ~~**${text}**~~ — done (${today}).`;
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ── edit item text ────────────────────────────────────────────────────────────

export function editItemTextInFile(filePath: string, rawLine: string, newText: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }

  if (rawLine.trimStart().startsWith('- [x]')) {
    lines[idx] = rawLine.replace(/~~\*\*.+?\*\*~~/, `~~**${newText}**~~`);
  } else {
    if (/\*\*.+?\*\*/.test(rawLine)) {
      lines[idx] = rawLine.replace(/\*\*.+?\*\*/, `**${newText}**`);
    } else {
      // No bold markers yet — wrap the text portion
      const content2 = rawLine.slice(5).trim();
      const dashIdx = content2.indexOf(' — ');
      const rest = dashIdx >= 0 ? content2.slice(dashIdx) : '';
      lines[idx] = `- [ ] **${newText}**${rest}`;
    }
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ── edit header (module or subsection) ───────────────────────────────────────

export function editHeaderInFile(filePath: string, rawLine: string, newTitle: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const idx = lines.findIndex(l => l === rawLine);
  if (idx === -1) { return; }

  const prefixMatch = rawLine.match(/^(#{1,6}\s+)/);
  const prefix = prefixMatch ? prefixMatch[1] : '## ';
  lines[idx] = prefix + newTitle;
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

// ── reorder items ─────────────────────────────────────────────────────────────

export function reorderItemsInFile(filePath: string, oldOrder: string[], newOrder: string[]): void {
  if (oldOrder.length !== newOrder.length) { return; }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Collect file indices for each old-order raw line (first occurrence)
  const indices = oldOrder.map(ol => lines.indexOf(ol)).filter(i => i >= 0);
  if (indices.length !== newOrder.length) { return; }

  // Assign new lines at the sorted file positions
  const sortedIndices = [...indices].sort((a, b) => a - b);
  sortedIndices.forEach((fileIdx, posIdx) => {
    lines[fileIdx] = newOrder[posIdx];
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}
