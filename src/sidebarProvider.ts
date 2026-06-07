// ── Sidebar Webview Provider ─────────────────────────────────────────────────
// Thin wrapper around WebviewHost — only sidebar-specific lifecycle logic.

import * as vscode from 'vscode';
import { WebviewHost } from './webviewHost';

export class SidebarProvider extends WebviewHost implements vscode.WebviewViewProvider {
  public static readonly viewType = 'openItemsTracker.sidebar';

  private _view?: vscode.WebviewView;

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this._extensionUri] };

    webviewView.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg), null, this._disposables
    );

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) { this.render(); }
    }, null, this._disposables);

    this.initShared();
  }

  // ── WebviewHost overrides ──────────────────────────────────────────────────

  protected getWebview(): vscode.Webview | undefined { return this._view?.webview; }
  protected setHtml(html: string): void { if (this._view) { this._view.webview.html = html; } }
}
