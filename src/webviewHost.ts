// ── Abstract base class for webview hosts ────────────────────────────────────
// Shared logic between OpenItemsPanel (WebviewPanel) and SidebarProvider (WebviewView).
// Eliminates ~120 lines of duplicated code.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseDocument } from './parser';
import { getHtml, getNoFileHtml, getErrorHtml, computeGitDiff } from './webview/index';
import {
  toggleItemInFile, editItemTextInFile, editHeaderInFile,
  editItemNoteInFile, editModuleContextInFile,
  reorderItemsInFile, reorderModulesInFile, reorderSubSectionsInFile,
  addItemToFile, deleteItemFromFile,
  addModuleToFile, deleteModuleFromFile,
  addSubSectionToFile, deleteSubSectionFromFile,
  changeItemStatusInFile, revertFileContent
} from './fileEditor';
import { getStoredPath, setStoredPath, onPathChange } from './store';
import { readSettings } from './settings';
import { getGitState } from './gitManager';
import { undoRedoManager } from './undoRedoManager';

export abstract class WebviewHost {
  protected _disposables: vscode.Disposable[] = [];
  protected _watcher?: vscode.FileSystemWatcher;

  constructor(protected readonly _extensionUri: vscode.Uri) {}

  // ── Abstract methods — implemented by subclasses ───────────────────────────

  /** Return the current webview instance, or undefined if not available yet. */
  protected abstract getWebview(): vscode.Webview | undefined;

  /** Set the HTML content of the webview. */
  protected abstract setHtml(html: string): void;

  // ── Optional overrides ─────────────────────────────────────────────────────

  /** Set the title (only meaningful for WebviewPanel, no-op for sidebar). */
  protected setTitle(_title: string): void { /* no-op by default */ }

  // ── Message handling ───────────────────────────────────────────────────────

  protected handleMessage(msg: { command: string; [key: string]: unknown }): void {
    const fp = this.resolveFile();
    switch (msg.command) {
      case 'skillStatus': vscode.commands.executeCommand('openItemsTracker.skillStatus'); break;
      case 'openFile':
        if (fp) { vscode.workspace.openTextDocument(fp).then(d => vscode.window.showTextDocument(d)); } break;
      case 'pickFile':   this.pickFile(); break;
      case 'dropFile':   if (msg.uri) { this.dropFile(msg.uri as string); } break;
      case 'clearFile':  setStoredPath(undefined); break;
      case 'useActiveFile': this.useActiveFile(); break;
      case 'openLink':
        if (msg.target) { this.openLinkTarget(msg.target as string); } break;
      case 'toggleItem':
        if (fp && msg.rawLine) { this.tryAction(() => toggleItemInFile(fp, msg.rawLine as string)); } break;
      case 'changeStatus':
        if (fp && msg.rawLine && msg.newStatus) { this.tryAction(() => changeItemStatusInFile(fp, msg.rawLine as string, msg.newStatus as 'open' | 'partial' | 'future' | 'done')); } break;
      case 'undo':
        if (fp) {
          const currentContent = fs.readFileSync(fp, 'utf8');
          const prevContent = undoRedoManager.undo(fp, currentContent);
          if (prevContent !== undefined) {
            this.tryAction(() => revertFileContent(fp, prevContent));
            this.render();
          }
        }
        break;
      case 'redo':
        if (fp) {
          const currentContent = fs.readFileSync(fp, 'utf8');
          const nextContent = undoRedoManager.redo(fp, currentContent);
          if (nextContent !== undefined) {
            this.tryAction(() => revertFileContent(fp, nextContent));
            this.render();
          }
        }
        break;
      case 'editItem':
        if (fp && msg.rawLine && msg.newText) { this.tryAction(() => editItemTextInFile(fp, msg.rawLine as string, msg.newText as string)); } break;
      case 'editHeader':
        if (fp && msg.rawLine && msg.newText) { this.tryAction(() => editHeaderInFile(fp, msg.rawLine as string, msg.newText as string)); } break;
      case 'reorderItems':
        if (fp && msg.oldOrder && msg.newOrder) { this.tryAction(() => reorderItemsInFile(fp, msg.oldOrder as string[], msg.newOrder as string[])); } break;
      case 'editItemNote':
        if (fp && msg.rawLine) { this.tryAction(() => editItemNoteInFile(fp, msg.rawLine as string, (msg.newNote as string) || '')); } break;
      case 'editModuleContext':
        if (fp && msg.moduleRawLine && msg.newContext) { this.tryAction(() => editModuleContextInFile(fp, msg.moduleRawLine as string, msg.newContext as string)); } break;
      case 'addItem':
        if (fp && msg.parentRawLine && msg.text) { this.tryAction(() => addItemToFile(fp, msg.parentRawLine as string, msg.text as string)); } break;
      case 'deleteItem':
        if (fp && msg.rawLine) { this.tryAction(() => deleteItemFromFile(fp, msg.rawLine as string)); } break;
      case 'addModule':
        if (fp && msg.title) { this.tryAction(() => addModuleToFile(fp, msg.title as string)); } break;
      case 'deleteModule':
        if (fp && msg.moduleRawLine) { this.tryAction(() => deleteModuleFromFile(fp, msg.moduleRawLine as string)); } break;
      case 'addSubSection':
        if (fp && msg.moduleRawLine && msg.title) { this.tryAction(() => addSubSectionToFile(fp, msg.moduleRawLine as string, msg.title as string)); } break;
      case 'deleteSubSection':
        if (fp && msg.subRawLine) { this.tryAction(() => deleteSubSectionFromFile(fp, msg.subRawLine as string)); } break;
      case 'reorderModules':
        if (fp && msg.oldOrder && msg.newOrder) { this.tryAction(() => reorderModulesInFile(fp, msg.oldOrder as string[], msg.newOrder as string[])); } break;
      case 'reorderSubSections':
        if (fp && msg.moduleRawLine && msg.oldOrder && msg.newOrder) { this.tryAction(() => reorderSubSectionsInFile(fp, msg.moduleRawLine as string, msg.oldOrder as string[], msg.newOrder as string[])); } break;
    }
  }

  // ── File resolution ────────────────────────────────────────────────────────

  protected resolveFile(): string | undefined {
    const stored = getStoredPath();
    if (stored && fs.existsSync(stored)) { return stored; }
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const p = path.join(folder.uri.fsPath, 'docs', 'open-items.md');
      if (fs.existsSync(p)) { return p; }
    }
    return undefined;
  }

  protected async pickFile(): Promise<void> {
    const result = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ['md'] }, title: 'Select open-items.md' });
    if (result?.[0]) { setStoredPath(result[0].fsPath); }
  }

  protected dropFile(uri: string): void {
    try { const p = vscode.Uri.parse(uri.split('\n')[0].trim()).fsPath; if (p) { setStoredPath(p); } } catch { /**/ }
  }

  protected useActiveFile(): void {
    const fp = vscode.window.activeTextEditor?.document.fileName;
    if (fp) { setStoredPath(fp); }
    else { vscode.window.showWarningMessage('Open Items Tracker: no file active in editor.'); }
  }

  // ── Link navigation ────────────────────────────────────────────────────────

  protected async openLinkTarget(target: string): Promise<void> {
    let filePath: string;
    let startLine: number | undefined;
    let endLine: number | undefined;

    // Separate fragment (#L10-L20) from path
    const hashIdx = target.indexOf('#');
    let rawPath = target;
    if (hashIdx > 0) {
      const fragment = target.substring(hashIdx + 1);
      rawPath = target.substring(0, hashIdx);
      const lineMatch = fragment.match(/^L(\d+)(?:-L?(\d+))?$/);
      if (lineMatch) {
        startLine = parseInt(lineMatch[1], 10);
        endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;
      }
    }

    // Resolve absolute vs relative path
    if (rawPath.startsWith('file:///')) {
      try {
        filePath = vscode.Uri.parse(rawPath).fsPath;
      } catch {
        vscode.window.showWarningMessage(`Open Items Tracker: invalid link URI: ${rawPath}`);
        return;
      }
    } else {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showWarningMessage('Open Items Tracker: no workspace folder open to resolve relative path.');
        return;
      }
      filePath = path.resolve(workspaceRoot, rawPath);
    }

    if (!fs.existsSync(filePath)) {
      vscode.window.showWarningMessage(`File not found: ${rawPath}`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc, { preview: false });

    if (startLine !== undefined) {
      const zeroStart = Math.max(0, startLine - 1);
      const zeroEnd = endLine !== undefined ? Math.max(0, endLine - 1) : zeroStart;
      const range = new vscode.Range(zeroStart, 0, zeroEnd, 0);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
  }

  // ── File watcher ───────────────────────────────────────────────────────────

  protected setupWatcher(): void {
    this._watcher?.dispose();
    const fp = this.resolveFile();
    if (!fp) { return; }
    const pattern = new vscode.RelativePattern(path.dirname(fp), path.basename(fp));
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this._watcher.onDidChange(() => {
      if (!undoRedoManager.isInternalWrite) {
        undoRedoManager.clearRedo(fp);
      }
      this.render();
    }, null, this._disposables);
    this._watcher.onDidCreate(() => this.render(), null, this._disposables);
    this._disposables.push(this._watcher);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  protected async render(): Promise<void> {
    const webview = this.getWebview();
    if (!webview) { return; }
    const fp = this.resolveFile();
    const settings = readSettings();
    if (!fp) {
      this.setHtml(getNoFileHtml(webview, this._extensionUri));
      this.setTitle('Open Items');
      return;
    }
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const doc = parseDocument(content, fp);
      this.setTitle(`Open Items (${doc.stats.done}/${doc.stats.total})`);

      let gitState;
      if (settings.gitIntegration) {
        const rawGit = await getGitState(fp);
        gitState = computeGitDiff(doc, rawGit.headContent, rawGit.isRepo, rawGit.status);
      } else {
        gitState = computeGitDiff(doc, undefined, false, 'clean');
      }

      const hasUndo = undoRedoManager.hasUndo(fp);
      const hasRedo = undoRedoManager.hasRedo(fp);

      this.setHtml(getHtml(webview, this._extensionUri, doc, settings, { hasUndo, hasRedo }, gitState));
    } catch {
      this.setHtml(getErrorHtml(webview, this._extensionUri));
    }
  }

  // ── Shared initialization ──────────────────────────────────────────────────

  protected initShared(): void {
    this._disposables.push(onPathChange(() => { this.setupWatcher(); this.render(); }));
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openItemsTracker')) { this.render(); }
      })
    );
    this.setupWatcher();
    this.render();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  protected tryAction(fn: () => void): void {
    try { fn(); } catch (e) { vscode.window.showErrorMessage(`Open Items Tracker: ${e}`); }
  }

  public dispose(): void {
    this._watcher?.dispose();
    while (this._disposables.length) { this._disposables.pop()!.dispose(); }
  }
}
