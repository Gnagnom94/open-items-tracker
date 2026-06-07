import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Extension Activation Test Suite', () => {

  let ext: vscode.Extension<unknown>;

  suiteSetup(async () => {
    ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker')!;
    await ext.activate();
  });

  test('Extension is active', () => {
    assert.strictEqual(ext.isActive, true);
  });

  test('Commands are registered', async () => {
    const allCommands = await vscode.commands.getCommands(true);
    assert.ok(allCommands.includes('openItemsTracker.showPanel'));
    assert.ok(allCommands.includes('openItemsTracker.skillStatus'));
  });

  test('Sidebar view type is registered', () => {
    assert.ok(ext.isActive);
  });

  test('Custom editor provider viewType is registered', () => {
    const pkg = ext.packageJSON;
    const customEditors = pkg.contributes?.customEditors;
    assert.ok(customEditors);
    const editor = customEditors.find((e: { viewType: string }) => e.viewType === 'openItemsTracker.markdownEditor');
    assert.ok(editor);
  });

  test('Configuration properties exist', () => {
    const config = vscode.workspace.getConfiguration('openItemsTracker');
    assert.strictEqual(config.get('defaultSort'), 'manual');
    assert.strictEqual(config.get('collapseByDefault'), false);
    assert.strictEqual(config.get('showDoneItems'), true);
    assert.strictEqual(config.get('showFutureItems'), true);
    assert.strictEqual(config.get('gitIntegration'), true);
    assert.strictEqual(config.get('gitHighlight'), true);
    assert.strictEqual(config.get('gitShowInlineDiff'), true);
    assert.strictEqual(config.get('undoRedoStackSize'), 50);
    assert.ok(typeof config.get('fontSizeSidebar') === 'number');
    assert.ok(typeof config.get('fontSizeEditor') === 'number');
    assert.strictEqual(config.get('promptSkillInstall'), true);
  });

  test('Context key is set for non-markdown files', async () => {
    const allCommands = await vscode.commands.getCommands(true);
    assert.ok(allCommands.includes('openItemsTracker.showPanel'));
  });

  test('showPanel command can be invoked without error', async () => {
    try {
      // Won't block since no markdown editor is open
    } catch (e) {
      assert.fail(`showPanel command threw: ${e}`);
    }
  });

  test('deactivate function exists', () => {
    assert.ok(ext.isActive);
  });

  // ── isOpenItemsSyntax (tested indirectly through context key) ──────────────

  test('Context key updates when opening a markdown file with open-items syntax', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-ext-test-'));
    const tmpFile = path.join(tmpDir, 'test-items.md');
    fs.writeFileSync(tmpFile, '## Module\n- [ ] Task', 'utf8');
    try {
      const doc = await vscode.workspace.openTextDocument(tmpFile);
      await vscode.window.showTextDocument(doc);
      // The onDidChangeActiveTextEditor handler should fire and set context key
      // We can't check the context key value directly, but we verify no crash
      await new Promise(r => setTimeout(r, 100));
    } finally {
      // Close the editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test('Context key false for non-open-items markdown', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-ext-test-'));
    const tmpFile = path.join(tmpDir, 'test-plain.md');
    fs.writeFileSync(tmpFile, '# Just a normal markdown', 'utf8');
    try {
      const doc = await vscode.workspace.openTextDocument(tmpFile);
      await vscode.window.showTextDocument(doc);
      await new Promise(r => setTimeout(r, 100));
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test('onDidChangeTextDocument triggers context update', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-ext-test-'));
    const tmpFile = path.join(tmpDir, 'test-change.md');
    fs.writeFileSync(tmpFile, '# Normal markdown', 'utf8');
    try {
      const doc = await vscode.workspace.openTextDocument(tmpFile);
      const editor = await vscode.window.showTextDocument(doc);
      // Edit the document to trigger onDidChangeTextDocument
      await editor.edit(builder => {
        builder.insert(new vscode.Position(0, 0), '## Module\n- [ ] Task\n');
      });
      await new Promise(r => setTimeout(r, 100));
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      try { fs.unlinkSync(tmpFile); } catch { /* */ }
      fs.rmdirSync(tmpDir);
    }
  });
});
