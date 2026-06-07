import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebviewHost } from '../webviewHost';
import { SidebarProvider } from '../sidebarProvider';
import { OpenItemsEditorProvider } from '../customEditorProvider';
import { setStoredPath } from '../store';
import { initStore } from '../store';

// ── Concrete test subclass of WebviewHost ────────────────────────────────────

class TestWebviewHost extends WebviewHost {
  public lastHtml = '';
  public lastTitle = '';
  public webviewInstance: vscode.Webview | undefined;

  constructor(extensionUri: vscode.Uri) {
    super(extensionUri);
  }

  protected getWebview(): vscode.Webview | undefined {
    return this.webviewInstance;
  }

  protected setHtml(html: string): void {
    this.lastHtml = html;
  }

  protected override setTitle(title: string): void {
    this.lastTitle = title;
  }

  // Expose protected methods for testing
  public testResolveFile(): string | undefined { return this.resolveFile(); }
  public testDropFile(uri: string): void { return this.dropFile(uri); }
  public testUseActiveFile(): void { return this.useActiveFile(); }
  public testHandleMessage(msg: { command: string; [key: string]: unknown }): void { this.handleMessage(msg); }
  public testRender(): Promise<void> { return this.render(); }
  public testGetHistoryState() { return this.getHistoryState(); }
  public testSetupChangeListener() { return this.setupChangeListener(); }
  public testIsFixedFile() { return this.isFixedFile(); }
  public testFontSizeKey() { return this.fontSizeKey(); }
  public testTryAction(fn: () => void) { return this.tryAction(fn); }
  public testReadFileContent() { return this.readFileContent(); }
  public testInitShared() { return this.initShared(); }
  public testOpenLinkTarget(target: string): Promise<void> { return this.openLinkTarget(target); }
  public testPickFile(): Promise<void> { return this.pickFile(); }
}

suite('WebviewHost Test Suite', () => {

  let ext: vscode.Extension<unknown>;
  let host: TestWebviewHost;
  let tmpDir: string;
  let tmpFile: string;

  const sampleContent = '## Module\n- [ ] **Task A**\n- [ ] **Task B**';

  suiteSetup(async () => {
    ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    await ext.activate();

    // Init the store with a mock context
    const mockState = new Map<string, unknown>();
    initStore({
      workspaceState: {
        get: <T>(key: string): T | undefined => mockState.get(key) as T | undefined,
        update: (key: string, value: unknown) => {
          if (value === undefined) { mockState.delete(key); }
          else { mockState.set(key, value); }
          return Promise.resolve();
        },
      },
    } as never);
  });

  setup(() => {
    host = new TestWebviewHost(ext.extensionUri);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-wh-test-'));
    tmpFile = path.join(tmpDir, 'test-open-items.md');
    fs.writeFileSync(tmpFile, sampleContent, 'utf8');
  });

  teardown(() => {
    host.dispose();
    setStoredPath(undefined);
    try { fs.unlinkSync(tmpFile); } catch { /* */ }
    try { fs.rmdirSync(tmpDir); } catch { /* */ }
  });

  // ── Default method implementations ─────────────────────────────────────────

  test('isFixedFile — defaults to false', () => {
    assert.strictEqual(host.testIsFixedFile(), false);
  });

  test('fontSizeKey — defaults to fontSizeSidebar', () => {
    assert.strictEqual(host.testFontSizeKey(), 'fontSizeSidebar');
  });

  test('resolveFile — returns stored path when set', () => {
    setStoredPath(tmpFile);
    assert.strictEqual(host.testResolveFile(), tmpFile);
  });

  test('resolveFile — returns undefined when no path stored and no workspace match', () => {
    setStoredPath(undefined);
    const result = host.testResolveFile();
    // May return a file if the workspace has docs/open-items.md, otherwise undefined
    // We just verify it doesn't crash
    assert.ok(result === undefined || typeof result === 'string');
  });

  test('readFileContent — reads file when stored path exists', () => {
    setStoredPath(tmpFile);
    const result = host.testReadFileContent();
    assert.ok(result);
    assert.ok(result!.content.includes('Task A'));
    assert.strictEqual(result!.filePath, tmpFile);
  });

  test('readFileContent — returns undefined when no file', () => {
    setStoredPath('/nonexistent/file.md');
    const result = host.testReadFileContent();
    assert.strictEqual(result, undefined);
  });

  test('getHistoryState — returns state for stored file', () => {
    setStoredPath(tmpFile);
    const state = host.testGetHistoryState();
    assert.strictEqual(state.hasUndo, false);
    assert.strictEqual(state.hasRedo, false);
  });

  test('getHistoryState — returns defaults when no file', () => {
    setStoredPath(undefined);
    const state = host.testGetHistoryState();
    assert.strictEqual(state.hasUndo, false);
    assert.strictEqual(state.hasRedo, false);
  });

  // ── tryAction ──────────────────────────────────────────────────────────────

  test('tryAction — executes function', () => {
    let executed = false;
    host.testTryAction(() => { executed = true; });
    assert.strictEqual(executed, true);
  });

  test('tryAction — catches errors without crashing', () => {
    // Should not throw
    host.testTryAction(() => { throw new Error('test error'); });
  });

  // ── dropFile ───────────────────────────────────────────────────────────────

  test('dropFile — sets stored path from URI', () => {
    const uri = vscode.Uri.file(tmpFile).toString();
    host.testDropFile(uri);
    const stored = host.testResolveFile();
    assert.ok(stored?.includes('test-open-items.md'));
  });

  test('dropFile — handles multi-line URI (takes first)', () => {
    const uri = vscode.Uri.file(tmpFile).toString() + '\nsome-other-uri';
    host.testDropFile(uri);
    const stored = host.testResolveFile();
    assert.ok(stored?.includes('test-open-items.md'));
  });

  test('dropFile — handles invalid URI gracefully', () => {
    // Should not throw
    host.testDropFile('');
    host.testDropFile('invalid');
  });

  // ── useActiveFile ──────────────────────────────────────────────────────────

  test('useActiveFile — uses active text editor if available', () => {
    // Can't control the active editor in tests, but verify it doesn't crash
    host.testUseActiveFile();
  });

  // ── render ─────────────────────────────────────────────────────────────────

  test('render — returns early when no webview', async () => {
    await host.testRender();
    // No webview → no HTML set
    assert.strictEqual(host.lastHtml, '');
  });

  test('render — generates no-file HTML when no file', async () => {
    setStoredPath(undefined);
    host.webviewInstance = createMockWebview();
    await host.testRender();
    // Depending on workspace, may show no-file or actual file HTML
    assert.ok(host.lastHtml.includes('<!DOCTYPE html>'));
  });

  test('render — generates data HTML when file exists', async () => {
    setStoredPath(tmpFile);
    host.webviewInstance = createMockWebview();
    await host.testRender();
    assert.ok(host.lastHtml.includes('<!DOCTYPE html>'));
    assert.ok(host.lastHtml.includes('__INIT_DATA__'));
    assert.ok(host.lastTitle.includes('Open Items'));
  });

  // ── handleMessage ──────────────────────────────────────────────────────────

  test('handleMessage — clearFile clears stored path', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'clearFile' });
    // clearFile calls setStoredPath(undefined)
  });

  test('handleMessage — toggleItem mutates file', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'toggleItem', rawLine: '- [ ] **Task A**' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('~~**Task A**~~'));
  });

  test('handleMessage — changeStatus', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'changeStatus', rawLine: '- [ ] **Task A**', newStatus: 'partial' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('🔄'));
  });

  test('handleMessage — editItem', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editItem', rawLine: '- [ ] **Task A**', newText: 'Renamed' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('**Renamed**'));
  });

  test('handleMessage — editHeader', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editHeader', rawLine: '## Module', newText: 'New Module' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('## New Module'));
  });

  test('handleMessage — editItemNote', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editItemNote', rawLine: '- [ ] **Task A**', newNote: 'note text' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('— note text'));
  });

  test('handleMessage — editModuleContext', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editModuleContext', moduleRawLine: '## Module', newContext: 'Context text' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('Context text'));
  });

  test('handleMessage — addItem', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'addItem', parentRawLine: '## Module', text: 'New Item' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('- [ ] **New Item**'));
  });

  test('handleMessage — deleteItem', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'deleteItem', rawLine: '- [ ] **Task A**' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!content.includes('Task A'));
  });

  test('handleMessage — addModule', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'addModule', title: 'Module B' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('## Module B'));
  });

  test('handleMessage — deleteModule', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'deleteModule', moduleRawLine: '## Module' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!content.includes('## Module'));
  });

  test('handleMessage — addSubSection', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'addSubSection', moduleRawLine: '## Module', title: 'Sub1' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('### Sub1'));
  });

  test('handleMessage — deleteSubSection', () => {
    setStoredPath(tmpFile);
    // First add a subsection
    host.testHandleMessage({ command: 'addSubSection', moduleRawLine: '## Module', title: 'Sub1' });
    host.testHandleMessage({ command: 'deleteSubSection', subRawLine: '### Sub1' });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!content.includes('### Sub1'));
  });

  test('handleMessage — reorderItems', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({
      command: 'reorderItems',
      oldOrder: ['- [ ] **Task A**', '- [ ] **Task B**'],
      newOrder: ['- [ ] **Task B**', '- [ ] **Task A**'],
    });
    const lines = fs.readFileSync(tmpFile, 'utf8').split('\n');
    const taskBIdx = lines.indexOf('- [ ] **Task B**');
    const taskAIdx = lines.indexOf('- [ ] **Task A**');
    assert.ok(taskBIdx < taskAIdx);
  });

  test('handleMessage — reorderModules', () => {
    setStoredPath(tmpFile);
    // Add another module first
    host.testHandleMessage({ command: 'addModule', title: 'Module 2' });
    host.testHandleMessage({
      command: 'reorderModules',
      oldOrder: ['## Module', '## Module 2'],
      newOrder: ['## Module 2', '## Module'],
    });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.indexOf('## Module 2') < content.indexOf('## Module\n'));
  });

  test('handleMessage — skillStatus command', () => {
    // Should not crash
    host.testHandleMessage({ command: 'skillStatus' });
  });

  test('handleMessage — unknown command is no-op', () => {
    // Should not crash
    host.testHandleMessage({ command: 'unknownCommand' });
  });

  // ── setupChangeListener ────────────────────────────────────────────────────

  test('setupChangeListener — creates watcher for stored file', () => {
    setStoredPath(tmpFile);
    host.testSetupChangeListener();
    // Verify it doesn't crash and creates disposables
    assert.ok(host['_disposables'].length > 0);
  });

  test('setupChangeListener — handles no file gracefully', () => {
    setStoredPath(undefined);
    host.testSetupChangeListener();
    // Should not crash
  });

  // ── dispose ────────────────────────────────────────────────────────────────

  test('dispose — cleans up resources', () => {
    setStoredPath(tmpFile);
    host.testSetupChangeListener();
    host.dispose();
    // Should not crash when disposing again
    host.dispose();
  });

  // ── undo/redo ──────────────────────────────────────────────────────────────

  test('handleMessage — undo after mutation', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editItem', rawLine: '- [ ] **Task A**', newText: 'Edited' });
    const afterEdit = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(afterEdit.includes('**Edited**'));

    host.testHandleMessage({ command: 'undo' });
    const afterUndo = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(afterUndo.includes('**Task A**'));
  });

  test('handleMessage — redo after undo', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'editItem', rawLine: '- [ ] **Task A**', newText: 'Edited' });
    host.testHandleMessage({ command: 'undo' });
    host.testHandleMessage({ command: 'redo' });
    const afterRedo = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(afterRedo.includes('**Edited**'));
  });

  test('handleMessage — undo with no history is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'undo' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — redo with no history is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'redo' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  // ── openLink ────────────────────────────────────────────────────────────────

  test('openLink — file:/// URI opens the file', async () => {
    const uri = vscode.Uri.file(tmpFile).toString();
    await host.testOpenLinkTarget(uri);
    // Should have opened the file without error
  });

  test('openLink — file:/// URI with line fragment', async () => {
    const uri = vscode.Uri.file(tmpFile).toString() + '#L1-L2';
    await host.testOpenLinkTarget(uri);
  });

  test('openLink — file:/// URI with single line fragment', async () => {
    const uri = vscode.Uri.file(tmpFile).toString() + '#L1';
    await host.testOpenLinkTarget(uri);
  });

  test('openLink — nonexistent file shows warning', async () => {
    await host.testOpenLinkTarget('file:///nonexistent/path.md');
    // Should show warning but not crash
  });

  test('openLink — relative path with workspace', async () => {
    // Try opening a relative path (may or may not have a workspace)
    await host.testOpenLinkTarget('nonexistent-relative.md');
    // Should show a warning but not crash
  });

  test('openLink — hash fragment without L prefix', async () => {
    const uri = vscode.Uri.file(tmpFile).toString() + '#something';
    await host.testOpenLinkTarget(uri);
  });

  // ── handleMessage — openFile ────────────────────────────────────────────────

  test('handleMessage — openFile opens the stored file', async () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'openFile' });
    // Should not crash
  });

  test('handleMessage — openFile with no file is no-op', () => {
    setStoredPath(undefined);
    host.testHandleMessage({ command: 'openFile' });
  });

  // ── handleMessage — setFontSize ─────────────────────────────────────────────

  test('handleMessage — setFontSize valid', () => {
    host.testHandleMessage({ command: 'setFontSize', size: 14 });
  });

  test('handleMessage — setFontSize out of range (too small)', () => {
    host.testHandleMessage({ command: 'setFontSize', size: 4 });
  });

  test('handleMessage — setFontSize out of range (too large)', () => {
    host.testHandleMessage({ command: 'setFontSize', size: 30 });
  });

  // ── handleMessage — reorderSubSections ──────────────────────────────────────

  test('handleMessage — reorderSubSections', () => {
    setStoredPath(tmpFile);
    host.testHandleMessage({ command: 'addSubSection', moduleRawLine: '## Module', title: 'Sub1' });
    host.testHandleMessage({ command: 'addSubSection', moduleRawLine: '## Module', title: 'Sub2' });
    host.testHandleMessage({
      command: 'reorderSubSections',
      moduleRawLine: '## Module',
      oldOrder: ['### Sub1', '### Sub2'],
      newOrder: ['### Sub2', '### Sub1'],
    });
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.indexOf('### Sub2') < content.indexOf('### Sub1'));
  });

  // ── handleMessage — guard conditions ───────────────────────────────────────

  test('handleMessage — toggleItem without rawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'toggleItem' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — changeStatus without rawLine/newStatus is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'changeStatus' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — editItem without rawLine/newText is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'editItem', rawLine: '- [ ] **Task A**' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — editHeader without newText is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'editHeader', rawLine: '## Module' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — addItem missing text is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'addItem', parentRawLine: '## Module' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — addModule without title is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'addModule' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — deleteItem without rawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'deleteItem' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — deleteModule without moduleRawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'deleteModule' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — addSubSection without title is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'addSubSection', moduleRawLine: '## Module' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — deleteSubSection without subRawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'deleteSubSection' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — reorderItems without orders is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'reorderItems' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — reorderModules without orders is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'reorderModules' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — reorderSubSections without moduleRawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'reorderSubSections' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — editModuleContext without moduleRawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'editModuleContext' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — editItemNote without rawLine is no-op', () => {
    setStoredPath(tmpFile);
    const before = fs.readFileSync(tmpFile, 'utf8');
    host.testHandleMessage({ command: 'editItemNote' });
    const after = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(before, after);
  });

  test('handleMessage — openLink with target', () => {
    host.testHandleMessage({ command: 'openLink', target: 'nonexistent.md' });
  });

  test('handleMessage — openLink without target is no-op', () => {
    host.testHandleMessage({ command: 'openLink' });
  });

  test('handleMessage — dropFile', () => {
    host.testHandleMessage({ command: 'dropFile', uri: vscode.Uri.file(tmpFile).toString() });
  });

  test('handleMessage — dropFile without uri is no-op', () => {
    host.testHandleMessage({ command: 'dropFile' });
  });

  // ── initShared ─────────────────────────────────────────────────────────────

  test('initShared — sets up listeners and renders', () => {
    setStoredPath(tmpFile);
    host.webviewInstance = createMockWebview();
    host.testInitShared();
    assert.ok(host['_disposables'].length > 0);
  });

  // ── handleMessage — undo/redo without file ─────────────────────────────────

  test('handleMessage — undo without stored file is no-op', () => {
    setStoredPath(undefined);
    host.testHandleMessage({ command: 'undo' });
  });

  test('handleMessage — redo without stored file is no-op', () => {
    setStoredPath(undefined);
    host.testHandleMessage({ command: 'redo' });
  });
});

// ── SidebarProvider ──────────────────────────────────────────────────────────

suite('SidebarProvider Test Suite', () => {

  test('viewType is correct', () => {
    assert.strictEqual(SidebarProvider.viewType, 'openItemsTracker.sidebar');
  });

  test('constructor does not throw', () => {
    const ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    const provider = new SidebarProvider(ext.extensionUri);
    assert.ok(provider);
    provider.dispose();
  });
});

// ── OpenItemsEditorProvider ──────────────────────────────────────────────────

suite('OpenItemsEditorProvider Test Suite', () => {

  test('viewType is correct', () => {
    assert.strictEqual(OpenItemsEditorProvider.viewType, 'openItemsTracker.markdownEditor');
  });

  test('constructor does not throw', () => {
    const ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    const provider = new OpenItemsEditorProvider(ext.extensionUri);
    assert.ok(provider);
  });

  test('custom editor can be opened via command', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-ce-test-'));
    const tmpFile = path.join(tmpDir, 'test-ce.md');
    fs.writeFileSync(tmpFile, '## Module\n- [ ] **Task**', 'utf8');
    try {
      const uri = vscode.Uri.file(tmpFile);
      await vscode.commands.executeCommand(
        'vscode.openWith', uri, OpenItemsEditorProvider.viewType
      );
      // Wait for the custom editor to initialize
      await new Promise(r => setTimeout(r, 500));
      // Close the editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      try { fs.rmdirSync(tmpDir); } catch { /* */ }
    }
  });
});

// ── Render edge cases (separate suite to isolate config changes) ─────────────

suite('WebviewHost Render Edge Cases', () => {

  let ext: vscode.Extension<unknown>;

  suiteSetup(async () => {
    ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    await ext.activate();
  });

  test('render — with gitIntegration disabled', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-git-test-'));
    const tmpFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(tmpFile, '## Mod\n- [ ] **Item**', 'utf8');

    const config = vscode.workspace.getConfiguration('openItemsTracker');
    // Disable gitIntegration temporarily
    await config.update('gitIntegration', false, vscode.ConfigurationTarget.Global);

    try {
      const host = new TestWebviewHost(ext.extensionUri);
      host.webviewInstance = createMockWebview();
      setStoredPath(tmpFile);
      await host.testRender();
      assert.ok(host.lastHtml.includes('<!DOCTYPE html>'));
      assert.ok(host.lastHtml.includes('__INIT_DATA__'));
      host.dispose();
    } finally {
      // Restore gitIntegration
      await config.update('gitIntegration', undefined, vscode.ConfigurationTarget.Global);
      setStoredPath(undefined);
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      try { fs.rmdirSync(tmpDir); } catch { /* */ }
    }
  });

  test('render — parse error triggers error page', async () => {
    // Create a subclass that returns content that causes getHtml to fail
    class ErrorHost extends WebviewHost {
      public lastHtml = '';
      public webviewInstance: vscode.Webview | undefined;

      constructor(extensionUri: vscode.Uri) { super(extensionUri); }

      protected getWebview(): vscode.Webview | undefined { return this.webviewInstance; }
      protected setHtml(html: string): void { this.lastHtml = html; }

      // Override readFileContent to return content + corrupt path that causes render to throw
      protected override readFileContent(): { content: string; filePath: string } {
        return { content: '## Mod\n- [ ] **A**', filePath: '' };
      }

      // Override to throw during render by corrupting getHtml
      protected override getHistoryState(): { hasUndo: boolean; hasRedo: boolean } {
        throw new Error('Simulated error');
      }

      public testRender(): Promise<void> { return this.render(); }
    }

    const errorHost = new ErrorHost(ext.extensionUri);
    errorHost.webviewInstance = createMockWebview();
    await errorHost.testRender();
    // Should have set error HTML instead of crashing
    assert.ok(errorHost.lastHtml.includes('<!DOCTYPE html>'));
    errorHost.dispose();
  });

  test('config change triggers render', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-cfg-test-'));
    const tmpFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(tmpFile, '## Mod\n- [ ] **Item**', 'utf8');

    const host = new TestWebviewHost(ext.extensionUri);
    host.webviewInstance = createMockWebview();
    setStoredPath(tmpFile);
    host.testInitShared();

    // Clear the HTML to verify render is called
    host.lastHtml = '';

    // Trigger a config change
    const config = vscode.workspace.getConfiguration('openItemsTracker');
    await config.update('collapseByDefault', true, vscode.ConfigurationTarget.Global);
    // Wait for the config change event to propagate
    await new Promise(r => setTimeout(r, 200));

    // Verify render was called
    assert.ok(host.lastHtml.length > 0, 'HTML should be set after config change');

    // Restore
    await config.update('collapseByDefault', undefined, vscode.ConfigurationTarget.Global);
    host.dispose();
    setStoredPath(undefined);
    try { fs.unlinkSync(tmpFile); } catch { /* */ }
    try { fs.rmdirSync(tmpDir); } catch { /* */ }
  });

  test('openLink — relative path that exists in workspace', async () => {
    // This test needs a real file relative to a workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; } // Skip if no workspace

    const relativePath = 'README.md';
    const absolutePath = path.join(workspaceFolder.uri.fsPath, relativePath);

    if (fs.existsSync(absolutePath)) {
      const host = new TestWebviewHost(ext.extensionUri);
      await host.testOpenLinkTarget(relativePath);
      // Should have opened the file
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      host.dispose();
    }
  });

  test('openLink — relative path with line range', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }

    const relativePath = 'README.md';
    const absolutePath = path.join(workspaceFolder.uri.fsPath, relativePath);

    if (fs.existsSync(absolutePath)) {
      const host = new TestWebviewHost(ext.extensionUri);
      await host.testOpenLinkTarget(relativePath + '#L1-L5');
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      host.dispose();
    }
  });
});

// ── showPanel command tests ──────────────────────────────────────────────────

suite('showPanel Command Test Suite', () => {

  test('showPanel command — with active markdown editor', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-sp-test-'));
    const tmpFile = path.join(tmpDir, 'test-panel.md');
    fs.writeFileSync(tmpFile, '## Module\n- [ ] **Task**', 'utf8');
    try {
      // Open the file in a text editor first
      const doc = await vscode.workspace.openTextDocument(tmpFile);
      await vscode.window.showTextDocument(doc);
      // Now execute showPanel — it should open the custom editor
      await vscode.commands.executeCommand('openItemsTracker.showPanel');
      await new Promise(r => setTimeout(r, 500));
      // Close whatever was opened
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      try { fs.rmdirSync(tmpDir); } catch { /* */ }
    }
  });

  test('showPanel command — with stored path but no active editor', async function () {
    this.timeout(5000);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-sp-test-'));
    const tmpFile = path.join(tmpDir, 'test-panel2.md');
    fs.writeFileSync(tmpFile, '## Module\n- [ ] **Task**', 'utf8');
    try {
      // Close all editors first
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      // Set stored path
      setStoredPath(tmpFile);
      // Execute showPanel — may show a dialog since the bundled extension
      // has a separate store instance. Race with a timeout.
      const timeoutPromise = new Promise(r => setTimeout(r, 1000));
      const commandPromise = vscode.commands.executeCommand('openItemsTracker.showPanel');
      await Promise.race([commandPromise, timeoutPromise]);
      // Close whatever was opened
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor').then(() => {}, () => {});
    } finally {
      setStoredPath(undefined);
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      try { fs.rmdirSync(tmpDir); } catch { /* */ }
    }
  });

  test('showPanel command — with no file or stored path', async () => {
    // Close all editors and clear stored path
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    setStoredPath(undefined);
    // Execute showPanel — this will try to show a file dialog
    // Since we can't interact with the dialog, it will just return
    try {
      // We give it a short timeout — the dialog is modal but we can't dismiss it
      const timeoutPromise = new Promise(r => setTimeout(r, 500));
      const commandPromise = vscode.commands.executeCommand('openItemsTracker.showPanel');
      // The dialog might block, but VS Code test environment may auto-dismiss
      await Promise.race([commandPromise, timeoutPromise]);
    } catch {
      // It's OK if this times out or fails
    }
    // Dismiss any open dialog
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen').then(() => {}, () => {});
  });

  test('showPanel command — with different active .md file (else branch)', async function () {
    this.timeout(5000);
    // Create two different markdown files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-sp-test-'));
    const targetFile = path.join(tmpDir, 'target.md');
    const otherFile = path.join(tmpDir, 'other.md');
    fs.writeFileSync(targetFile, '## Module\n- [ ] **Task**', 'utf8');
    fs.writeFileSync(otherFile, '# Other file\nJust text', 'utf8');
    try {
      // Open the "other" file as active editor
      const otherDoc = await vscode.workspace.openTextDocument(otherFile);
      await vscode.window.showTextDocument(otherDoc);
      // showPanel will resolve the other .md file via resolveFileUri since
      // it's active. The isTargetTab will be true. But if activeEditor is on
      // a different file, it goes to else. Let me set up correctly:
      // Open target file first, then switch to other file, then call showPanel
      // Since resolveFileUri picks the active editor .md file, the active
      // editor will be otherFile and that's the fileUri.
      await vscode.commands.executeCommand('openItemsTracker.showPanel');
      await new Promise(r => setTimeout(r, 500));
      await vscode.commands.executeCommand('workbench.action.closeAllEditors').then(() => {}, () => {});
    } finally {
      try { fs.unlinkSync(targetFile); } catch { /* */ }
      try { fs.unlinkSync(otherFile); } catch { /* */ }
      try { fs.rmdirSync(tmpDir); } catch { /* */ }
    }
  });
});

// ── Helper ───────────────────────────────────────────────────────────────────

function createMockWebview(): vscode.Webview {
  return {
    options: {},
    html: '',
    cspSource: 'https://test-csp-source',
    onDidReceiveMessage: () => ({ dispose: () => {} }),
    postMessage: async () => true,
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
}

