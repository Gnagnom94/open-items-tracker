// ── Custom Editor Provider ───────────────────────────────────────────────────
// Registers the extension as a custom editor for .md files, making it appear
// in the "Reopen Editor With..." menu. Uses CustomEditorHost which overrides
// WebviewHost's I/O methods to use TextDocument + WorkspaceEdit.

import * as vscode from 'vscode';
import { WebviewHost } from './webviewHost';
import { applyDocTransform } from './documentEditor';
import type { LinesTransform } from './fileTransforms';
import type { HistoryState } from './shared/types';

// ── Provider ─────────────────────────────────────────────────────────────────

export class OpenItemsEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'openItemsTracker.markdownEditor';

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): void {
    new CustomEditorHost(this._extensionUri, webviewPanel, document);
  }
}

// ── Custom Editor Host ───────────────────────────────────────────────────────
// Extends WebviewHost, overriding I/O methods to use TextDocument instead of fs.

class CustomEditorHost extends WebviewHost {

  constructor(
    extensionUri: vscode.Uri,
    private readonly _panel: vscode.WebviewPanel,
    private readonly _document: vscode.TextDocument
  ) {
    super(extensionUri);

    this._panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [extensionUri],
    };

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg), null, this._disposables
    );

    this.initShared();
  }

  // ── WebviewHost abstract implementations ──────────────────────────────────

  protected getWebview(): vscode.Webview { return this._panel.webview; }
  protected setHtml(html: string): void { this._panel.webview.html = html; }
  protected setTitle(title: string): void { this._panel.title = title; }

  // ── Override: ignore file-selection commands ───────────────────────────────
  // The custom editor is bound to a specific TextDocument — file picking,
  // dropping, clearing, and "use active" are not applicable.

  protected override handleMessage(msg: { command: string; [key: string]: unknown }): void {
    switch (msg.command) {
      case 'pickFile':
      case 'dropFile':
      case 'clearFile':
      case 'useActiveFile':
        return;
      default:
        super.handleMessage(msg);
    }
  }

  // ── Override: file resolution is fixed to the TextDocument ─────────────────

  protected override resolveFile(): string {
    return this._document.uri.fsPath;
  }

  protected override isFixedFile(): boolean { return true; }

  protected override fontSizeKey() { return 'fontSizeEditor' as const; }

  // ── Override: read from TextDocument instead of fs ─────────────────────────

  protected override readFileContent(): { content: string; filePath: string } {
    return {
      content: this._document.getText(),
      filePath: this._document.uri.fsPath,
    };
  }

  // ── Override: mutations via WorkspaceEdit ──────────────────────────────────

  protected override executeMutation(transform: LinesTransform): void {
    applyDocTransform(this._document, transform);
  }

  // ── Override: undo/redo delegated to VS Code native ───────────────────────

  protected override handleUndo(): void {
    vscode.commands.executeCommand('undo');
  }

  protected override handleRedo(): void {
    vscode.commands.executeCommand('redo');
  }

  protected override getHistoryState(): HistoryState {
    // VS Code manages the undo stack natively — always report as available.
    // The actual availability is controlled by VS Code's internal state.
    return { hasUndo: true, hasRedo: true };
  }

  // ── Override: listen to TextDocument changes instead of FileSystemWatcher ──

  protected override setupChangeListener(): void {
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.toString() === this._document.uri.toString()) {
          this.render();
        }
      })
    );
  }

  // ── Override: initShared without store-based path listening ────────────────
  // The custom editor is bound to a specific document — no need to listen to
  // stored path changes or react to configuration-based path resolution.

  protected override initShared(): void {
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('openItemsTracker')) { this.render(); }
      })
    );
    this.setupChangeListener();
    this.render();
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  public override dispose(): void {
    this._panel.dispose();
    super.dispose();
  }
}
