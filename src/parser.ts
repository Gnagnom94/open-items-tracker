import type { ItemStatus, OpenItem, SubSection, Module, ParsedDocument } from './shared/types';

// Re-export for backward compatibility
export type { ItemStatus, OpenItem, SubSection, Module, ParsedDocument };

function parseItem(line: string): OpenItem | null {
  if (!line.startsWith('- [x]') && !line.startsWith('- [ ]')) { return null; }

  const isDone = line.startsWith('- [x]');
  const content = line.slice(5).trim();

  if (isDone) {
    const textMatch = content.match(/~~\*\*(.+?)\*\*~~/);
    const dateMatch = content.match(/\((\d{4}-\d{2}-\d{2})\)/);
    const noteMatch = content.match(/~~\*\*.+?\*\*~~\s*[—–]\s*done\s*\([^)]*\)\.\s*(.*)/i);
    const note = noteMatch && noteMatch[1].trim() ? noteMatch[1].trim() : undefined;
    return {
      rawLine: line,
      text: textMatch ? textMatch[1] : content.replace(/~~|\*\*/g, '').replace(/[—–].*$/, '').trim(),
      status: 'done',
      date: dateMatch?.[1],
      note,
    };
  }

  const isPartial = content.includes('🔄');
  const isFuture = content.includes('🔮') || /future\s*phase/i.test(content);
  const boldMatch = content.match(/\*\*(.+?)\*\*/);
  const dashIdx = content.indexOf(' — ');
  let note = dashIdx >= 0 ? content.slice(dashIdx + 3).trim() : undefined;
  if (note) { note = note.replace(/🔄|🔮/g, '').trim() || undefined; }
  let text = boldMatch ? boldMatch[1] : dashIdx >= 0 ? content.slice(0, dashIdx) : content;
  text = text.replace(/🔄|🔮/g, '').replace(/\*\*/g, '').trim();

  return { rawLine: line, text, status: isFuture ? 'future' : isPartial ? 'partial' : 'open', note };
}

function flatItems(mod: Module): OpenItem[] {
  return [...mod.items, ...mod.subSections.flatMap(s => s.items)];
}

export function parseDocument(content: string, filePath?: string): ParsedDocument {
  const lines = content.split('\n');
  const modules: Module[] = [];
  let currentModule: Module | null = null;
  let currentSubSection: SubSection | null = null;
  let lastUpdated: string | undefined;

  for (const line of lines) {
    const luMatch = line.match(/Last updated:\s*(\d{4}-\d{2}-\d{2})/);
    if (luMatch) { lastUpdated = luMatch[1]; continue; }

    if (line.startsWith('## ')) {
      currentSubSection = null;
      currentModule = { rawLine: line, title: line.slice(3).trim(), context: '', subSections: [], items: [] };
      modules.push(currentModule);
      continue;
    }

    if (line.startsWith('### ')) {
      currentSubSection = { rawLine: line, title: line.slice(4).trim(), items: [] };
      currentModule?.subSections.push(currentSubSection);
      continue;
    }

    if (line.startsWith('- [')) {
      const item = parseItem(line);
      if (item) {
        if (currentSubSection) { currentSubSection.items.push(item); }
        else if (currentModule) { currentModule.items.push(item); }
      }
      continue;
    }

    if (
      currentModule && !currentSubSection &&
      line.trim() && !line.startsWith('#') && !line.startsWith('-') && line.trim() !== '---'
    ) {
      currentModule.context += (currentModule.context ? ' ' : '') + line.trim();
    }
  }

  const allItems = modules.flatMap(flatItems);
  return {
    lastUpdated, filePath, modules,
    stats: {
      total: allItems.length,
      done: allItems.filter(i => i.status === 'done').length,
      open: allItems.filter(i => i.status === 'open').length,
      partial: allItems.filter(i => i.status === 'partial').length,
      future: allItems.filter(i => i.status === 'future').length,
    },
  };
}
