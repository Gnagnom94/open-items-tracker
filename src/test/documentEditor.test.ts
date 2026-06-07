import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyDocTransform } from '../documentEditor';
import { toggleItem } from '../fileTransforms';

suite('documentEditor Test Suite', () => {

  let tmpDir: string;
  let tmpFile: string;
  let tmpUri: vscode.Uri;

  const sampleContent = '## Module\n- [ ] **Task A**\n- [ ] **Task B**';

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-doc-test-'));
    tmpFile = path.join(tmpDir, 'doc-test.md');
    fs.writeFileSync(tmpFile, sampleContent, 'utf8');
    tmpUri = vscode.Uri.file(tmpFile);
  });

  teardown(() => {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
  });

  test('applyDocTransform — applies transformation', async () => {
    const doc = await vscode.workspace.openTextDocument(tmpUri);
    const result = await applyDocTransform(doc, toggleItem('- [ ] **Task A**'));
    assert.strictEqual(result, true);
    assert.ok(doc.getText().includes('~~**Task A**~~'));
  });

  test('applyDocTransform — returns false for no-op', async () => {
    const doc = await vscode.workspace.openTextDocument(tmpUri);
    const result = await applyDocTransform(doc, (lines) => [...lines]);
    assert.strictEqual(result, false);
  });
});
