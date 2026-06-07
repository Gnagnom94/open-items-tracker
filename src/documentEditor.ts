// ── TextDocument-based I/O adapter ───────────────────────────────────────────
// Reads from vscode.TextDocument, writes via WorkspaceEdit.
// Used by CustomEditorHost (TextDocument-mode hosts).
// Undo/redo is handled natively by VS Code — no undoRedoManager needed.

import * as vscode from 'vscode';
import type { LinesTransform } from './fileTransforms';

/**
 * Apply a pure line transformation to a TextDocument via WorkspaceEdit.
 * Returns true if the edit was applied, false if no changes were needed or it failed.
 */
export async function applyDocTransform(
  document: vscode.TextDocument,
  transform: LinesTransform
): Promise<boolean> {
  const oldContent = document.getText();
  const lines = oldContent.split('\n');
  const newLines = transform(lines);
  const newContent = newLines.join('\n');

  if (newContent === oldContent) { return false; }

  const edit = new vscode.WorkspaceEdit();
  const lastLine = document.lineCount - 1;
  const lastChar = document.lineAt(lastLine).text.length;
  const fullRange = new vscode.Range(0, 0, lastLine, lastChar);
  edit.replace(document.uri, fullRange, newContent);

  return vscode.workspace.applyEdit(edit);
}
