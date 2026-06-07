import * as assert from 'assert';
import * as vscode from 'vscode';
import { nonce, getHtml, getNoFileHtml, getErrorHtml } from '../webview/htmlTemplates';
import type { ParsedDocument, ExtensionSettings, RenderGitState, HistoryState } from '../shared/types';

suite('htmlTemplates Test Suite', () => {

  // ── nonce ──────────────────────────────────────────────────────────────────

  test('nonce — returns 32-character string', () => {
    const n = nonce();
    assert.strictEqual(n.length, 32);
  });

  test('nonce — only contains alphanumeric characters', () => {
    const n = nonce();
    assert.ok(/^[A-Za-z0-9]+$/.test(n), `Nonce should be alphanumeric: ${n}`);
  });

  test('nonce — each call returns a different value', () => {
    const n1 = nonce();
    const n2 = nonce();
    assert.notStrictEqual(n1, n2);
  });

  // ── HTML generators require a Webview — we use the extension's URI ─────────

  let extensionUri: vscode.Uri;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    await ext.activate();
    extensionUri = ext.extensionUri;
  });

  function createMockWebview(): vscode.Webview {
    // We can't easily create a real Webview in tests, but we can mock the minimal interface
    return {
      options: {},
      html: '',
      cspSource: 'https://test-csp-source',
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      postMessage: async () => true,
      asWebviewUri: (uri: vscode.Uri) => uri,
    } as unknown as vscode.Webview;
  }

  // ── getHtml ────────────────────────────────────────────────────────────────

  test('getHtml — returns valid HTML with data and settings', () => {
    const webview = createMockWebview();
    const data: ParsedDocument = {
      modules: [],
      stats: { total: 0, done: 0, open: 0, partial: 0, future: 0 },
      filePath: '/test.md',
    };
    const settings: ExtensionSettings = {
      defaultSort: 'manual',
      collapseByDefault: false,
      showDoneItems: true,
      showFutureItems: true,
      gitIntegration: true,
      gitHighlight: true,
      gitShowInlineDiff: true,
      undoRedoStackSize: 50,
      fontSize: 12,
    };
    const historyState: HistoryState = { hasUndo: false, hasRedo: false };
    const gitState: RenderGitState = {
      isRepo: false,
      status: 'error',
      stats: { added: 0, modified: 0, deleted: 0 },
      itemStatus: {},
      itemDiffHtml: {},
      itemNoteDiffHtml: {},
      deletedItems: {},
    };

    const html = getHtml(webview, extensionUri, data, settings, historyState, gitState);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('__INIT_DATA__'));
    assert.ok(html.includes('nonce-'));
    assert.ok(html.includes('Content-Security-Policy'));
  });

  test('getHtml — isFixedFile omits drop overlay', () => {
    const webview = createMockWebview();
    const data: ParsedDocument = { modules: [], stats: { total: 0, done: 0, open: 0, partial: 0, future: 0 } };
    const settings: ExtensionSettings = {
      defaultSort: 'manual', collapseByDefault: false, showDoneItems: true,
      showFutureItems: true, gitIntegration: true, gitHighlight: true,
      gitShowInlineDiff: true, undoRedoStackSize: 50, fontSize: 12,
    };
    const historyState: HistoryState = { hasUndo: false, hasRedo: false };
    const gitState: RenderGitState = {
      isRepo: false, status: 'error',
      stats: { added: 0, modified: 0, deleted: 0 },
      itemStatus: {}, itemDiffHtml: {}, itemNoteDiffHtml: {}, deletedItems: {},
    };

    const htmlFixed = getHtml(webview, extensionUri, data, settings, historyState, gitState, true);
    const htmlNotFixed = getHtml(webview, extensionUri, data, settings, historyState, gitState, false);
    assert.ok(!htmlFixed.includes('dropOverlay'));
    assert.ok(htmlNotFixed.includes('dropOverlay'));
  });

  // ── getNoFileHtml ──────────────────────────────────────────────────────────

  test('getNoFileHtml — returns valid no-file page', () => {
    const webview = createMockWebview();
    const html = getNoFileHtml(webview, extensionUri);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('No open-items.md found'));
    assert.ok(html.includes('useActiveBtn'));
    assert.ok(html.includes('pickFileBtn'));
    assert.ok(html.includes('skillStatusBtn'));
    assert.ok(html.includes('__INIT_DATA__ = null'));
  });

  // ── getErrorHtml ───────────────────────────────────────────────────────────

  test('getErrorHtml — returns valid error page', () => {
    const webview = createMockWebview();
    const html = getErrorHtml(webview, extensionUri);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Error reading file'));
    assert.ok(html.includes('Content-Security-Policy'));
  });
});
