// ── Webview Panel (standalone tab) ───────────────────────────────────────────
// Thin wrapper around WebviewHost — only panel-specific lifecycle logic.

import * as vscode from 'vscode';
import { setStoredPath } from './store';
import { WebviewHost } from './webviewHost';

export class OpenItemsPanel extends WebviewHost {
  public static currentPanel: OpenItemsPanel | undefined;
  private static readonly viewType = 'openItemsTracker';

  private readonly _panel: vscode.WebviewPanel;

  public static createOrShow(extensionUri: vscode.Uri, filePath?: string): void {
    // activeTextEditor may be undefined when no editor tab is focused;
    // this state cannot be reliably reproduced in the VS Code test host.
    /* c8 ignore next */
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
    super(extensionUri);
    this._panel = panel;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg), null, this._disposables
    );

    this.initShared();
  }

  // ── WebviewHost overrides ──────────────────────────────────────────────────

  protected getWebview(): vscode.Webview { return this._panel.webview; }
  protected setHtml(html: string): void { this._panel.webview.html = html; }
  protected setTitle(title: string): void { this._panel.title = title; }

  // ── Dispose ────────────────────────────────────────────────────────────────

  public override dispose(): void {
    OpenItemsPanel.currentPanel = undefined;
    this._panel.dispose();
    super.dispose();
  }
}
