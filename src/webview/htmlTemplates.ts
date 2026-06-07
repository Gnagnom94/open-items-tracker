// ── HTML templates for webview pages ─────────────────────────────────────────
// Generates the full HTML documents served to the webview, using asWebviewUri()
// for external CSS and JS resources.

import * as vscode from 'vscode';
import type { ParsedDocument, ExtensionSettings, RenderGitState, HistoryState } from '../shared/types';

// ── Nonce generation ─────────────────────────────────────────────────────────

export function nonce(): string {
  let t = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) { t += c.charAt(Math.floor(Math.random() * c.length)); }
  return t;
}

// ── Resource URI helpers ─────────────────────────────────────────────────────

function getCssUri(webview: vscode.Webview, extensionUri: vscode.Uri): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'webview.css'));
}

function getScriptUri(webview: vscode.Webview, extensionUri: vscode.Uri): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
}

// ── Main page (with data) ────────────────────────────────────────────────────

export function getHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  data: ParsedDocument,
  settings: ExtensionSettings,
  historyState: HistoryState,
  gitState: RenderGitState,
  isFixedFile = false
): string {
  const n = nonce();
  const cssUri = getCssUri(webview, extensionUri);
  const scriptUri = getScriptUri(webview, extensionUri);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${n}';">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  ${isFixedFile ? '' : `<div id="dropOverlay" class="drop-overlay hidden">
    <div class="drop-message">&#128194; Drop open-items.md here</div>
  </div>`}
  <div id="app"></div>
  <script nonce="${n}">
    window.__INIT_DATA__ = ${JSON.stringify({ data, settings, historyState, gitState, isFixedFile })};
  </script>
  <script nonce="${n}" src="${scriptUri}"></script>
</body>
</html>`;
}

// ── No-file page ─────────────────────────────────────────────────────────────

export function getNoFileHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const n = nonce();
  const cssUri = getCssUri(webview, extensionUri);
  const scriptUri = getScriptUri(webview, extensionUri);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${n}';">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="dropZone" class="drop-zone">
    <div class="empty-icon">&#128203;</div>
    <h2>No open-items.md found</h2>
    <p>Open the file in an editor and click <strong>Use Active Editor</strong>,<br>
    choose it manually, or drop it from the OS file manager.</p>
    <div class="empty-actions">
      <button class="btn-primary" id="useActiveBtn">Use Active Editor</button>
      <button class="btn-secondary" id="pickFileBtn">Choose File&hellip;</button>
      <button class="btn-secondary" id="skillStatusBtn">&#x1F9E9; AI Skill</button>
    </div>
  </div>
  <script nonce="${n}">
    window.__INIT_DATA__ = null;
  </script>
  <script nonce="${n}" src="${scriptUri}"></script>
</body>
</html>`;
}

// ── Error page ───────────────────────────────────────────────────────────────

export function getErrorHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const cssUri = getCssUri(webview, extensionUri);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body><div class="empty-state"><div class="empty-icon">&#9888;&#65039;</div><h2>Error reading file</h2><p>Could not read or parse <code>open-items.md</code>.</p></div></body></html>`;
}
