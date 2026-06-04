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

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openItemsTracker.sidebar';

  private _view?: vscode.WebviewView;
  private _watcher?: vscode.FileSystemWatcher;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

    webviewView.webview.onDidReceiveMessage(async msg => {
      const fp = this._resolveFile();
      switch (msg.command) {
        case 'openFile':
          if (fp) { vscode.workspace.openTextDocument(fp).then(d => vscode.window.showTextDocument(d)); } break;
        case 'pickFile':   await this._pickFile(); break;
        case 'dropFile':   if (msg.uri) { this._dropFile(msg.uri); } break;
        case 'clearFile':  setStoredPath(undefined); break;
        case 'useActiveFile': this._useActiveFile(); break;
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

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) { this._render(); }
    }, null, this._disposables);

    this._disposables.push(onPathChange(() => { this._setupWatcher(); this._render(); }));

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
    if (!this._view) { return; }
    const fp = this._resolveFile();
    const settings = readSettings();
    if (!fp) { this._view.webview.html = getNoFileHtml(); return; }
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const doc = parseDocument(content, fp);

      let gitState;
      if (settings.gitIntegration) {
        const rawGit = await getGitState(fp);
        gitState = computeGitDiff(doc, rawGit.headContent, rawGit.isRepo, rawGit.status);
      } else {
        gitState = computeGitDiff(doc, undefined, false, 'clean');
      }

      const hasUndo = undoRedoManager.hasUndo(fp);
      const hasRedo = undoRedoManager.hasRedo(fp);

      this._view.webview.html = getHtml(doc, settings, { hasUndo, hasRedo }, gitState);
    } catch {
      this._view.webview.html = getErrorHtml();
    }
  }

  public dispose(): void {
    this._watcher?.dispose();
    while (this._disposables.length) { this._disposables.pop()!.dispose(); }
  }
}
