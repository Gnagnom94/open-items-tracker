// ── Abstract base class for webview hosts ────────────────────────────────────
// Shared logic between SidebarProvider, OpenItemsPanel, and CustomEditorHost.
// Provides default fs-based implementations for mutations, rendering, and
// change-listening. CustomEditorHost overrides these with TextDocument-based
// implementations.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseDocument } from './parser';
import { getHtml, getNoFileHtml, getErrorHtml, computeGitDiff } from './webview/index';
import { applyFsTransform, revertFileContent } from './fileEditor';
import { getStoredPath, setStoredPath, onPathChange } from './store';
import { readSettings } from './settings';
import type { FontSizeKey } from './settings';
import { getGitState } from './gitManager';
import { undoRedoManager } from './undoRedoManager';
import type { LinesTransform } from './fileTransforms';
import type { HistoryState } from './shared/types';
import {
  toggleItem, changeItemStatus, editItemText, editItemNote,
  editHeader, editModuleContext, addItem, deleteItem,
  addModule, deleteModule, addSubSection, deleteSubSection,
  reorderItems, reorderModules, reorderSubSections
} from './fileTransforms';

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

  /** Whether the host is bound to a fixed file (e.g. custom editor). Default: false. */
  protected isFixedFile(): boolean { return false; }

  /** Which font-size setting to use. Default: sidebar. */
  protected fontSizeKey(): FontSizeKey { return 'fontSizeSidebar'; }

  // ── Overridable I/O methods ────────────────────────────────────────────────
  // Default implementations are fs-based. CustomEditorHost overrides these
  // with TextDocument + WorkspaceEdit implementations.

  /** Read the current file content and path. Default: fs.readFileSync. */
  protected readFileContent(): { content: string; filePath: string } | undefined {
    const fp = this.resolveFile();
    if (!fp || !fs.existsSync(fp)) { return undefined; }
    return { content: fs.readFileSync(fp, 'utf8'), filePath: fp };
  }

  /** Apply a pure line transformation. Default: fs-based via fileEditor. */
  protected executeMutation(transform: LinesTransform): void {
    const fp = this.resolveFile();
    if (!fp) { return; }
    applyFsTransform(fp, transform);
  }

  /** Handle undo action. Default: undoRedoManager. */
  protected handleUndo(): void {
    const fp = this.resolveFile();
    if (!fp) { return; }
    const currentContent = fs.readFileSync(fp, 'utf8');
    const prevContent = undoRedoManager.undo(fp, currentContent);
    if (prevContent !== undefined) {
      this.tryAction(() => revertFileContent(fp, prevContent));
      this.render();
    }
  }

  /** Handle redo action. Default: undoRedoManager. */
  protected handleRedo(): void {
    const fp = this.resolveFile();
    if (!fp) { return; }
    const currentContent = fs.readFileSync(fp, 'utf8');
    const nextContent = undoRedoManager.redo(fp, currentContent);
    if (nextContent !== undefined) {
      this.tryAction(() => revertFileContent(fp, nextContent));
      this.render();
    }
  }

  /** Get undo/redo availability for rendering. Default: undoRedoManager state. */
  protected getHistoryState(): HistoryState {
    const fp = this.resolveFile();
    if (!fp) { return { hasUndo: false, hasRedo: false }; }
    return {
      hasUndo: undoRedoManager.hasUndo(fp),
      hasRedo: undoRedoManager.hasRedo(fp),
    };
  }

  /** Setup listener for file changes. Default: FileSystemWatcher. */
  protected setupChangeListener(): void {
    this._watcher?.dispose();
    const fp = this.resolveFile();
    if (!fp) { return; }
    const pattern = new vscode.RelativePattern(path.dirname(fp), path.basename(fp));
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
    /* c8 ignore start -- async callback: requires external file modification to trigger */
    this._watcher.onDidChange(() => {
      if (!undoRedoManager.isInternalWrite) {
        undoRedoManager.clearRedo(fp);
      }
      this.render();
    }, null, this._disposables);
    /* c8 ignore stop */
    this._watcher.onDidCreate(() => this.render(), null, this._disposables);
    this._disposables.push(this._watcher);
  }

  // ── Message handling ───────────────────────────────────────────────────────

  protected handleMessage(msg: { command: string; [key: string]: unknown }): void {
    switch (msg.command) {
      case 'skillStatus': vscode.commands.executeCommand('openItemsTracker.skillStatus'); break;
      case 'openFile': {
        const file = this.readFileContent();
        if (file) { vscode.workspace.openTextDocument(file.filePath).then(d => vscode.window.showTextDocument(d)); }
        break;
      }
      case 'pickFile':   this.pickFile(); break;
      case 'dropFile':   if (msg.uri) { this.dropFile(msg.uri as string); } break;
      case 'clearFile':  setStoredPath(undefined); break;
      case 'useActiveFile': this.useActiveFile(); break;
      case 'openLink':
        if (msg.target) { this.openLinkTarget(msg.target as string); } break;

      // ── Mutations — delegated to overridable executeMutation ────────────
      case 'toggleItem':
        if (msg.rawLine) { this.tryAction(() => this.executeMutation(toggleItem(msg.rawLine as string))); } break;
      case 'changeStatus':
        if (msg.rawLine && msg.newStatus) { this.tryAction(() => this.executeMutation(changeItemStatus(msg.rawLine as string, msg.newStatus as 'open' | 'partial' | 'future' | 'done'))); } break;
      case 'editItem':
        if (msg.rawLine && msg.newText) { this.tryAction(() => this.executeMutation(editItemText(msg.rawLine as string, msg.newText as string))); } break;
      case 'editHeader':
        if (msg.rawLine && msg.newText) { this.tryAction(() => this.executeMutation(editHeader(msg.rawLine as string, msg.newText as string))); } break;
      case 'editItemNote':
        if (msg.rawLine) { this.tryAction(() => this.executeMutation(editItemNote(msg.rawLine as string, (msg.newNote as string) || ''))); } break;
      case 'editModuleContext':
        if (msg.moduleRawLine && msg.newContext) { this.tryAction(() => this.executeMutation(editModuleContext(msg.moduleRawLine as string, msg.newContext as string))); } break;
      case 'addItem':
        if (msg.parentRawLine && msg.text) { this.tryAction(() => this.executeMutation(addItem(msg.parentRawLine as string, msg.text as string))); } break;
      case 'deleteItem':
        if (msg.rawLine) { this.tryAction(() => this.executeMutation(deleteItem(msg.rawLine as string))); } break;
      case 'addModule':
        if (msg.title) { this.tryAction(() => this.executeMutation(addModule(msg.title as string))); } break;
      case 'deleteModule':
        if (msg.moduleRawLine) { this.tryAction(() => this.executeMutation(deleteModule(msg.moduleRawLine as string))); } break;
      case 'addSubSection':
        if (msg.moduleRawLine && msg.title) { this.tryAction(() => this.executeMutation(addSubSection(msg.moduleRawLine as string, msg.title as string))); } break;
      case 'deleteSubSection':
        if (msg.subRawLine) { this.tryAction(() => this.executeMutation(deleteSubSection(msg.subRawLine as string))); } break;
      case 'reorderItems':
        if (msg.oldOrder && msg.newOrder) { this.tryAction(() => this.executeMutation(reorderItems(msg.oldOrder as string[], msg.newOrder as string[]))); } break;
      case 'reorderModules':
        if (msg.oldOrder && msg.newOrder) { this.tryAction(() => this.executeMutation(reorderModules(msg.oldOrder as string[], msg.newOrder as string[]))); } break;
      case 'reorderSubSections':
        if (msg.moduleRawLine && msg.oldOrder && msg.newOrder) { this.tryAction(() => this.executeMutation(reorderSubSections(msg.moduleRawLine as string, msg.oldOrder as string[], msg.newOrder as string[]))); } break;

      // ── Font size ─────────────────────────────────────────────────────────
      case 'setFontSize': {
        const size = msg.size as number;
        if (size >= 8 && size <= 24) {
          vscode.workspace.getConfiguration('openItemsTracker').update(this.fontSizeKey(), size, vscode.ConfigurationTarget.Global);
        }
        break;
      }

      // ── Undo/Redo — delegated to overridable methods ───────────────────
      case 'undo': this.handleUndo(); break;
      case 'redo': this.handleRedo(); break;
    }
  }

  // ── File resolution ────────────────────────────────────────────────────────

  protected resolveFile(): string | undefined {
    const stored = getStoredPath();
    if (stored && fs.existsSync(stored)) { return stored; }
    /* c8 ignore next 4 -- requires docs/open-items.md in workspace */
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const p = path.join(folder.uri.fsPath, 'docs', 'open-items.md');
      if (fs.existsSync(p)) { return p; }
    }
    return undefined;
  }

  /* c8 ignore next 4 -- dialog interaction: showOpenDialog blocks in tests */
  protected async pickFile(): Promise<void> {
    const result = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ['md'] }, title: 'Select open-items.md' });
    if (result?.[0]) { setStoredPath(result[0].fsPath); }
  }

  protected dropFile(uri: string): void {
    try { const p = vscode.Uri.parse(uri.split('\n')[0].trim()).fsPath; if (p) { setStoredPath(p); } } catch { /**/ }
  }

  protected useActiveFile(): void {
    // 1. Standard text editor
    const fp = vscode.window.activeTextEditor?.document.fileName;
    if (fp) { setStoredPath(fp); return; }

    // 2. Custom editor (activeTextEditor is undefined for custom editors)
    /* c8 ignore next 10 -- requires activeTextEditor to be undefined with custom editor tab */
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab?.input instanceof vscode.TabInputCustom) {
      setStoredPath(activeTab.input.uri.fsPath);
      return;
    }
    if (activeTab?.input instanceof vscode.TabInputText) {
      setStoredPath(activeTab.input.uri.fsPath);
      return;
    }

    vscode.window.showWarningMessage('Open Items Tracker: no file active in editor.');
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
      } catch /* c8 ignore start */ {
        vscode.window.showWarningMessage(`Open Items Tracker: invalid link URI: ${rawPath}`);
        return;
      } /* c8 ignore stop */
    } else {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) /* c8 ignore start */ {
        vscode.window.showWarningMessage('Open Items Tracker: no workspace folder open to resolve relative path.');
        return;
      } /* c8 ignore stop */
      /* c8 ignore next 2 -- requires relative-path link click from webview */
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

  // ── Render ─────────────────────────────────────────────────────────────────

  protected async render(): Promise<void> {
    const webview = this.getWebview();
    if (!webview) { return; }
    const settings = readSettings(this.fontSizeKey());
    const fileInfo = this.readFileContent();
    if (!fileInfo) {
      this.setHtml(getNoFileHtml(webview, this._extensionUri));
      this.setTitle('Open Items');
      return;
    }
    try {
      const doc = parseDocument(fileInfo.content, fileInfo.filePath);
      this.setTitle(`Open Items (${doc.stats.done}/${doc.stats.total})`);

      let gitState;
      if (settings.gitIntegration) {
        const rawGit = await getGitState(fileInfo.filePath);
        gitState = computeGitDiff(doc, rawGit.headContent, rawGit.isRepo, rawGit.status);
      } else {
        gitState = computeGitDiff(doc, undefined, false, 'clean');
      }

      const historyState = this.getHistoryState();

      this.setHtml(getHtml(webview, this._extensionUri, doc, settings, historyState, gitState, this.isFixedFile()));
    } catch {
      this.setHtml(getErrorHtml(webview, this._extensionUri));
    }
  }

  // ── Shared initialization ──────────────────────────────────────────────────

  protected initShared(): void {
    this._disposables.push(onPathChange(() => { this.setupChangeListener(); this.render(); }));
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openItemsTracker')) { this.render(); }
      })
    );
    this.setupChangeListener();
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
