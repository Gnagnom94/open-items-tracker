import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseDocument } from './parser';
import { getHtml, getNoFileHtml, getErrorHtml, computeGitDiff } from './renderer';
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

export class OpenItemsPanel {
  public static currentPanel: OpenItemsPanel | undefined;
  private static readonly viewType = 'openItemsTracker';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _watcher: vscode.FileSystemWatcher | undefined;

  public static createOrShow(extensionUri: vscode.Uri, filePath?: string): void {
    const column = vscode.window.activeTextEditor?.viewColumn;
    if (OpenItemsPanel.currentPanel) {
      OpenItemsPanel.currentPanel._panel.reveal(column);
      if (filePath) { setStoredPath(filePath); }
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      OpenItemsPanel.viewType, 'Open Items',
      column || vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [extensionUri] }
    );
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'icon-light.svg'),
      dark:  vscode.Uri.joinPath(extensionUri, 'resources', 'icon-dark.svg'),
    };
    if (filePath) { setStoredPath(filePath); }
    OpenItemsPanel.currentPanel = new OpenItemsPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(async msg => {
      const fp = this._resolveFile();
      switch (msg.command) {
        case 'skillStatus': vscode.commands.executeCommand('openItemsTracker.skillStatus'); break;
        case 'openFile':
          if (fp) { vscode.workspace.openTextDocument(fp).then(d => vscode.window.showTextDocument(d)); } break;
        case 'pickFile':   await this._pickFile(); break;
        case 'dropFile':   if (msg.uri) { this._dropFile(msg.uri); } break;
        case 'clearFile':  setStoredPath(undefined); break;
        case 'useActiveFile': this._useActiveFile(); break;
        case 'openLink':
          if (msg.target) { await this._openLinkTarget(msg.target); } break;
        case 'toggleItem':
          if (fp && msg.rawLine) { this._try(() => toggleItemInFile(fp, msg.rawLine)); } break;
        case 'changeStatus':
          if (fp && msg.rawLine && msg.newStatus) { this._try(() => changeItemStatusInFile(fp, msg.rawLine, msg.newStatus)); } break;
        case 'undo':
          if (fp) {
            const currentContent = fs.readFileSync(fp, 'utf8');
            const prevContent = undoRedoManager.undo(fp, currentContent);
            if (prevContent !== undefined) {
              this._try(() => revertFileContent(fp, prevContent));
              this._render();
            }
          }
          break;
        case 'redo':
          if (fp) {
            const currentContent = fs.readFileSync(fp, 'utf8');
            const nextContent = undoRedoManager.redo(fp, currentContent);
            if (nextContent !== undefined) {
              this._try(() => revertFileContent(fp, nextContent));
              this._render();
            }
          }
          break;
        case 'editItem':
          if (fp && msg.rawLine && msg.newText) { this._try(() => editItemTextInFile(fp, msg.rawLine, msg.newText)); } break;
        case 'editHeader':
          if (fp && msg.rawLine && msg.newText) { this._try(() => editHeaderInFile(fp, msg.rawLine, msg.newText)); } break;
        case 'reorderItems':
          if (fp && msg.oldOrder && msg.newOrder) { this._try(() => reorderItemsInFile(fp, msg.oldOrder, msg.newOrder)); } break;
        case 'editItemNote':
          if (fp && msg.rawLine) { this._try(() => editItemNoteInFile(fp, msg.rawLine, msg.newNote || '')); } break;
        case 'editModuleContext':
          if (fp && msg.moduleRawLine && msg.newContext) { this._try(() => editModuleContextInFile(fp, msg.moduleRawLine, msg.newContext)); } break;
        case 'addItem':
          if (fp && msg.parentRawLine && msg.text) { this._try(() => addItemToFile(fp, msg.parentRawLine, msg.text)); } break;
        case 'deleteItem':
          if (fp && msg.rawLine) { this._try(() => deleteItemFromFile(fp, msg.rawLine)); } break;
        case 'addModule':
          if (fp && msg.title) { this._try(() => addModuleToFile(fp, msg.title)); } break;
        case 'deleteModule':
          if (fp && msg.moduleRawLine) { this._try(() => deleteModuleFromFile(fp, msg.moduleRawLine)); } break;
        case 'addSubSection':
          if (fp && msg.moduleRawLine && msg.title) { this._try(() => addSubSectionToFile(fp, msg.moduleRawLine, msg.title)); } break;
        case 'deleteSubSection':
          if (fp && msg.subRawLine) { this._try(() => deleteSubSectionFromFile(fp, msg.subRawLine)); } break;
        case 'reorderModules':
          if (fp && msg.oldOrder && msg.newOrder) { this._try(() => reorderModulesInFile(fp, msg.oldOrder, msg.newOrder)); } break;
        case 'reorderSubSections':
          if (fp && msg.moduleRawLine && msg.oldOrder && msg.newOrder) { this._try(() => reorderSubSectionsInFile(fp, msg.moduleRawLine, msg.oldOrder, msg.newOrder)); } break;
      }
    }, null, this._disposables);

    this._disposables.push(onPathChange(() => { this._setupWatcher(); this._render(); }));

    // re-render when settings change
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openItemsTracker')) { this._render(); }
      })
    );

    this._setupWatcher();
    this._render();
  }

  private _try(fn: () => void): void {
    try { fn(); } catch (e) { vscode.window.showErrorMessage(`Open Items Tracker: ${e}`); }
  }

  private _resolveFile(): string | undefined {
    const stored = getStoredPath();
    if (stored && fs.existsSync(stored)) { return stored; }
    for (const folder of vscode.workspace.workspaceFolders || []) {
      const p = path.join(folder.uri.fsPath, 'docs', 'open-items.md');
      if (fs.existsSync(p)) { return p; }
    }
    return undefined;
  }

  private async _pickFile(): Promise<void> {
    const result = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Markdown: ['md'] }, title: 'Select open-items.md' });
    if (result?.[0]) { setStoredPath(result[0].fsPath); }
  }

  private _dropFile(uri: string): void {
    try { const p = vscode.Uri.parse(uri.split('\n')[0].trim()).fsPath; if (p) { setStoredPath(p); } } catch { /**/ }
  }

  private _useActiveFile(): void {
    const fp = vscode.window.activeTextEditor?.document.fileName;
    if (fp) { setStoredPath(fp); }
    else { vscode.window.showWarningMessage('Open Items Tracker: no file active in editor.'); }
  }

  private async _openLinkTarget(target: string): Promise<void> {
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

  private _setupWatcher(): void {
    this._watcher?.dispose();
    const fp = this._resolveFile();
    if (!fp) { return; }
    const pattern = new vscode.RelativePattern(path.dirname(fp), path.basename(fp));
    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this._watcher.onDidChange(() => {
      if (!undoRedoManager.isInternalWrite) {
        undoRedoManager.clearRedo(fp);
      }
      this._render();
    }, null, this._disposables);
    this._watcher.onDidCreate(() => this._render(), null, this._disposables);
    this._disposables.push(this._watcher);
  }

  private async _render(): Promise<void> {
    const fp = this._resolveFile();
    const settings = readSettings();
    if (!fp) {
      this._panel.webview.html = getNoFileHtml();
      this._panel.title = 'Open Items';
      return;
    }
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const doc = parseDocument(content, fp);
      this._panel.title = `Open Items (${doc.stats.done}/${doc.stats.total})`;

      let gitState;
      if (settings.gitIntegration) {
        const rawGit = await getGitState(fp);
        gitState = computeGitDiff(doc, rawGit.headContent, rawGit.isRepo, rawGit.status);
      } else {
        gitState = computeGitDiff(doc, undefined, false, 'clean');
      }

      const hasUndo = undoRedoManager.hasUndo(fp);
      const hasRedo = undoRedoManager.hasRedo(fp);

      this._panel.webview.html = getHtml(doc, settings, { hasUndo, hasRedo }, gitState);
    } catch {
      this._panel.webview.html = getErrorHtml();
    }
  }

  public dispose(): void {
    OpenItemsPanel.currentPanel = undefined;
    this._panel.dispose();
    this._watcher?.dispose();
    while (this._disposables.length) { this._disposables.pop()!.dispose(); }
  }
}
