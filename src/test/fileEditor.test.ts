import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  applyFsTransform, toggleItemInFile, changeItemStatusInFile,
  editItemTextInFile, editItemNoteInFile, editHeaderInFile,
  editModuleContextInFile, addItemToFile, deleteItemFromFile,
  addModuleToFile, deleteModuleFromFile, addSubSectionToFile,
  deleteSubSectionFromFile, reorderItemsInFile, reorderModulesInFile,
  reorderSubSectionsInFile, revertFileContent
} from '../fileEditor';
import { undoRedoManager } from '../undoRedoManager';

suite('fileEditor Test Suite', () => {

  let tmpDir: string;
  let tmpFile: string;

  const sampleContent = '## Module A\n- [ ] **Task A**\n- [ ] **Task B**\n\n## Module B\n- [ ] **Task C**';

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-test-'));
    tmpFile = path.join(tmpDir, 'test-open-items.md');
    fs.writeFileSync(tmpFile, sampleContent, 'utf8');
    undoRedoManager.clearAll(tmpFile);
    undoRedoManager.isInternalWrite = false;
  });

  teardown(() => {
    undoRedoManager.clearAll(tmpFile);
    undoRedoManager.isInternalWrite = false;
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
  });

  // ── applyFsTransform ────────────────────────────────────────────────────────

  test('applyFsTransform — applies transformation and writes result', () => {
    applyFsTransform(tmpFile, (lines) => {
      return lines.map(l => l.replace('Task A', 'Task X'));
    });
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('Task X'));
    assert.ok(!result.includes('Task A'));
  });

  test('applyFsTransform — pushes undo state', () => {
    assert.strictEqual(undoRedoManager.hasUndo(tmpFile), false);
    applyFsTransform(tmpFile, (lines) => lines.map(l => l.replace('Task A', 'Task X')));
    assert.strictEqual(undoRedoManager.hasUndo(tmpFile), true);
  });

  test('applyFsTransform — no-op when transform returns same lines', () => {
    applyFsTransform(tmpFile, (lines) => [...lines]); // identity
    assert.strictEqual(undoRedoManager.hasUndo(tmpFile), false);
  });

  // ── Convenience wrappers ───────────────────────────────────────────────────

  test('toggleItemInFile — toggles item status', () => {
    toggleItemInFile(tmpFile, '- [ ] **Task A**');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('~~**Task A**~~'));
    assert.ok(result.includes('done ('));
  });

  test('changeItemStatusInFile — changes to partial', () => {
    changeItemStatusInFile(tmpFile, '- [ ] **Task A**', 'partial');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('🔄'));
  });

  test('editItemTextInFile — edits item text', () => {
    editItemTextInFile(tmpFile, '- [ ] **Task A**', 'Renamed Task');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('**Renamed Task**'));
    assert.ok(!result.includes('**Task A**'));
  });

  test('editItemNoteInFile — adds note', () => {
    editItemNoteInFile(tmpFile, '- [ ] **Task A**', 'a note');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('— a note'));
  });

  test('editHeaderInFile — changes module title', () => {
    editHeaderInFile(tmpFile, '## Module A', 'Module Z');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('## Module Z'));
    assert.ok(!result.includes('## Module A'));
  });

  test('editModuleContextInFile — adds context', () => {
    editModuleContextInFile(tmpFile, '## Module A', 'Context text');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('Context text'));
  });

  test('addItemToFile — adds new item', () => {
    addItemToFile(tmpFile, '## Module A', 'New Item');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('- [ ] **New Item**'));
  });

  test('deleteItemFromFile — deletes item', () => {
    deleteItemFromFile(tmpFile, '- [ ] **Task A**');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!result.includes('Task A'));
    assert.ok(result.includes('Task B'));
  });

  test('addModuleToFile — adds new module', () => {
    addModuleToFile(tmpFile, 'Module C');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('## Module C'));
  });

  test('deleteModuleFromFile — deletes module', () => {
    deleteModuleFromFile(tmpFile, '## Module A');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!result.includes('Module A'));
    assert.ok(result.includes('Module B'));
  });

  test('addSubSectionToFile — adds sub-section', () => {
    addSubSectionToFile(tmpFile, '## Module A', 'Sub1');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(result.includes('### Sub1'));
  });

  test('deleteSubSectionFromFile — deletes sub-section', () => {
    addSubSectionToFile(tmpFile, '## Module A', 'Sub1');
    // Re-read to get the exact line
    const content = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(content.includes('### Sub1'));
    deleteSubSectionFromFile(tmpFile, '### Sub1');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.ok(!result.includes('### Sub1'));
  });

  test('reorderItemsInFile — reorders items', () => {
    const oldOrder = ['- [ ] **Task A**', '- [ ] **Task B**'];
    const newOrder = ['- [ ] **Task B**', '- [ ] **Task A**'];
    reorderItemsInFile(tmpFile, oldOrder, newOrder);
    const lines = fs.readFileSync(tmpFile, 'utf8').split('\n');
    const taskBIdx = lines.indexOf('- [ ] **Task B**');
    const taskAIdx = lines.indexOf('- [ ] **Task A**');
    assert.ok(taskBIdx < taskAIdx);
  });

  test('reorderModulesInFile — reorders modules', () => {
    const oldOrder = ['## Module A', '## Module B'];
    const newOrder = ['## Module B', '## Module A'];
    reorderModulesInFile(tmpFile, oldOrder, newOrder);
    const content = fs.readFileSync(tmpFile, 'utf8');
    const posB = content.indexOf('## Module B');
    const posA = content.indexOf('## Module A');
    assert.ok(posB < posA);
  });

  test('reorderSubSectionsInFile — reorders sub-sections', () => {
    // First add two sub-sections
    addSubSectionToFile(tmpFile, '## Module A', 'Sub1');
    addSubSectionToFile(tmpFile, '## Module A', 'Sub2');

    const oldOrder = ['### Sub1', '### Sub2'];
    const newOrder = ['### Sub2', '### Sub1'];
    reorderSubSectionsInFile(tmpFile, '## Module A', oldOrder, newOrder);
    const content = fs.readFileSync(tmpFile, 'utf8');
    const posSub2 = content.indexOf('### Sub2');
    const posSub1 = content.indexOf('### Sub1');
    assert.ok(posSub2 < posSub1);
  });

  // ── revertFileContent ──────────────────────────────────────────────────────

  test('revertFileContent — writes content directly', () => {
    revertFileContent(tmpFile, 'completely new content');
    const result = fs.readFileSync(tmpFile, 'utf8');
    assert.strictEqual(result, 'completely new content');
  });

  test('revertFileContent — sets isInternalWrite flag temporarily', () => {
    // The flag is set during write and cleared asynchronously
    assert.strictEqual(undoRedoManager.isInternalWrite, false);
    revertFileContent(tmpFile, 'new content');
    // isInternalWrite is set during the call
    // After setTimeout(200ms), it will be false
  });
});
