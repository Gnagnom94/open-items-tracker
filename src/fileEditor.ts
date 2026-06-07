// ── Filesystem-based I/O adapter ─────────────────────────────────────────────
// Reads/writes via fs with undo/redo tracking.
// Used by SidebarProvider and OpenItemsPanel (fs-mode hosts).

import * as fs from 'fs';
import { undoRedoManager } from './undoRedoManager';
import type { LinesTransform } from './fileTransforms';
import {
  toggleItem, changeItemStatus, editItemText, editItemNote,
  editHeader, editModuleContext, addItem, deleteItem,
  addModule, deleteModule, addSubSection, deleteSubSection,
  reorderItems, reorderModules, reorderSubSections
} from './fileTransforms';

// ── I/O primitives ───────────────────────────────────────────────────────────

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function writeLines(filePath: string, lines: string[]): void {
  try {
    const oldContent = fs.readFileSync(filePath, 'utf8');
    const newContent = lines.join('\n');
    if (oldContent !== newContent) {
      undoRedoManager.pushState(filePath, oldContent);
      undoRedoManager.isInternalWrite = true;
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  } finally {
    setTimeout(() => {
      undoRedoManager.isInternalWrite = false;
    }, 200);
  }
}

// ── Generic transform applier ────────────────────────────────────────────────

export function applyFsTransform(filePath: string, transform: LinesTransform): void {
  const lines = readLines(filePath);
  const newLines = transform(lines);
  writeLines(filePath, newLines);
}

// ── Convenience wrappers (backward-compatible API) ───────────────────────────

export function toggleItemInFile(filePath: string, rawLine: string): void {
  applyFsTransform(filePath, toggleItem(rawLine));
}

export function changeItemStatusInFile(
  filePath: string, rawLine: string, newStatus: 'open' | 'partial' | 'future' | 'done'
): void {
  applyFsTransform(filePath, changeItemStatus(rawLine, newStatus));
}

export function editItemTextInFile(filePath: string, rawLine: string, newText: string): void {
  applyFsTransform(filePath, editItemText(rawLine, newText));
}

export function editItemNoteInFile(filePath: string, rawLine: string, newNote: string): void {
  applyFsTransform(filePath, editItemNote(rawLine, newNote));
}

export function editHeaderInFile(filePath: string, rawLine: string, newTitle: string): void {
  applyFsTransform(filePath, editHeader(rawLine, newTitle));
}

export function editModuleContextInFile(filePath: string, moduleRawLine: string, newContext: string): void {
  applyFsTransform(filePath, editModuleContext(moduleRawLine, newContext));
}

export function addItemToFile(filePath: string, parentRawLine: string, text: string): void {
  applyFsTransform(filePath, addItem(parentRawLine, text));
}

export function deleteItemFromFile(filePath: string, rawLine: string): void {
  applyFsTransform(filePath, deleteItem(rawLine));
}

export function addModuleToFile(filePath: string, title: string): void {
  applyFsTransform(filePath, addModule(title));
}

export function deleteModuleFromFile(filePath: string, moduleRawLine: string): void {
  applyFsTransform(filePath, deleteModule(moduleRawLine));
}

export function addSubSectionToFile(filePath: string, moduleRawLine: string, title: string): void {
  applyFsTransform(filePath, addSubSection(moduleRawLine, title));
}

export function deleteSubSectionFromFile(filePath: string, subRawLine: string): void {
  applyFsTransform(filePath, deleteSubSection(subRawLine));
}

export function reorderItemsInFile(filePath: string, oldOrder: string[], newOrder: string[]): void {
  applyFsTransform(filePath, reorderItems(oldOrder, newOrder));
}

export function reorderModulesInFile(filePath: string, oldOrder: string[], newOrder: string[]): void {
  applyFsTransform(filePath, reorderModules(oldOrder, newOrder));
}

export function reorderSubSectionsInFile(
  filePath: string, moduleRawLine: string, oldOrder: string[], newOrder: string[]
): void {
  applyFsTransform(filePath, reorderSubSections(moduleRawLine, oldOrder, newOrder));
}

// ── revert file content (undo/redo) ──────────────────────────────────────────

export function revertFileContent(filePath: string, content: string): void {
  undoRedoManager.isInternalWrite = true;
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } finally {
    setTimeout(() => {
      undoRedoManager.isInternalWrite = false;
    }, 200);
  }
}
