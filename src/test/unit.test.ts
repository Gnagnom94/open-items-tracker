import * as assert from 'assert';
import { undoRedoManager } from '../undoRedoManager';
import { diffTextInline, computeGitDiff } from '../renderer';
import { parseDocument } from '../parser';

suite('Unit Test Suite', () => {
  test('UndoRedoManager Stack Operations', () => {
    const file = 'dummy-file.md';
    undoRedoManager.clearAll(file);
    undoRedoManager.setMaxStackSize(3);

    assert.strictEqual(undoRedoManager.hasUndo(file), false);
    assert.strictEqual(undoRedoManager.hasRedo(file), false);

    undoRedoManager.pushState(file, 'state 1');
    assert.strictEqual(undoRedoManager.hasUndo(file), true);
    assert.strictEqual(undoRedoManager.hasRedo(file), false);

    undoRedoManager.pushState(file, 'state 2');
    undoRedoManager.pushState(file, 'state 3');
    undoRedoManager.pushState(file, 'state 4'); // should drop 'state 1' because limit is 3

    // undo 1
    const s3 = undoRedoManager.undo(file, 'state 5');
    assert.strictEqual(s3, 'state 4');
    assert.strictEqual(undoRedoManager.hasRedo(file), true);

    // undo 2
    const s2 = undoRedoManager.undo(file, 'state 4');
    assert.strictEqual(s2, 'state 3');

    // undo 3
    const s1 = undoRedoManager.undo(file, 'state 3');
    assert.strictEqual(s1, 'state 2');

    // undo 4 - should fail because state 1 was dropped
    const s0 = undoRedoManager.undo(file, 'state 2');
    assert.strictEqual(s0, undefined);

    // redo 1
    const r3 = undoRedoManager.redo(file, 'state 2');
    assert.strictEqual(r3, 'state 3');

    // redo 2
    const r4 = undoRedoManager.redo(file, 'state 3');
    assert.strictEqual(r4, 'state 4');

    // redo 3
    const r5 = undoRedoManager.redo(file, 'state 4');
    assert.strictEqual(r5, 'state 5');

    // redo 4 - should fail
    const r6 = undoRedoManager.redo(file, 'state 5');
    assert.strictEqual(r6, undefined);
  });

  test('Inline Word Diffing', () => {
    const oldText = 'Role-based access control';
    const newText = 'Role-based access control (admin / viewer)';
    const diff = diffTextInline(oldText, newText);
    assert.ok(diff.includes('Role-based access control'));
    assert.ok(diff.includes('<ins class="git-diff-ins">admin</ins>'));
    assert.ok(diff.includes('<ins class="git-diff-ins">viewer</ins>'));

    const oldText2 = 'Old text here';
    const newText2 = 'New text here';
    const diff2 = diffTextInline(oldText2, newText2);
    assert.ok(diff2.includes('<del class="git-diff-del">Old</del>'));
    assert.ok(diff2.includes('<ins class="git-diff-ins">New</ins>'));
  });

  test('Git Diff Parser & List Diffing', () => {
    const current = `# Open Items\n## Module A\n- [ ] **FR-1 — Item 1**\n- [ ] **FR-2 — Item 2 modified**\n- [ ] **FR-3 — Item 3**`;
    const head = `# Open Items\n## Module A\n- [ ] **FR-1 — Item 1**\n- [ ] **FR-2 — Item 2**\n- [ ] **FR-4 — Item 4**`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    assert.strictEqual(gitDiff.stats.added, 1); // FR-3 is added
    assert.strictEqual(gitDiff.stats.modified, 1); // FR-2 is modified
    assert.strictEqual(gitDiff.stats.deleted, 1); // FR-4 is deleted

    // Check classification
    const m = curDoc.modules[0];
    const item1Line = m.items[0].rawLine;
    const item2Line = m.items[1].rawLine;
    const item3Line = m.items[2].rawLine;

    assert.strictEqual(gitDiff.itemStatus[item1Line], 'clean');
    assert.strictEqual(gitDiff.itemStatus[item2Line], 'modified');
    assert.strictEqual(gitDiff.itemStatus[item3Line], 'added');

    // Check deleted items are populated
    const deletedList = gitDiff.deletedItems[m.rawLine];
    assert.ok(deletedList);
    assert.strictEqual(deletedList.length, 1);
    assert.strictEqual(deletedList[0].text, 'FR-4 — Item 4');
  });

  test('Git Diff Parser — Reordered Items', () => {
    const current = `# Open Items\n## Module A\n- [ ] **FR-1 — Item 1**\n- [ ] **FR-3 — Item 3**\n- [ ] **FR-2 — Item 2**`;
    const head = `# Open Items\n## Module A\n- [ ] **FR-1 — Item 1**\n- [ ] **FR-2 — Item 2**\n- [ ] **FR-3 — Item 3**`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    const m = curDoc.modules[0];
    const item1Line = m.items[0].rawLine;
    const item3Line = m.items[1].rawLine;
    const item2Line = m.items[2].rawLine;

    assert.strictEqual(gitDiff.itemStatus[item1Line], 'clean');
    assert.strictEqual(gitDiff.itemStatus[item3Line], 'clean');
    assert.strictEqual(gitDiff.itemStatus[item2Line], 'modified'); // FR-2 moved and is marked modified!
  });

  test('Git Diff Parser — Reordered Milestones (No Text Mismatch)', () => {
    const current = `# Open Items\n## Module B\n- [ ] **[M1] Item B**\n- [ ] **[M1] Item A**`;
    const head = `# Open Items\n## Module B\n- [ ] **[M1] Item A**\n- [ ] **[M1] Item B**`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    const m = curDoc.modules[0];
    const itemBLine = m.items[0].rawLine;
    const itemALine = m.items[1].rawLine;

    // One item is treated as the LIS anchor (clean), and the other is marked modified (reordered)
    assert.strictEqual(gitDiff.itemStatus[itemBLine], 'clean');
    assert.strictEqual(gitDiff.itemStatus[itemALine], 'modified');
    assert.strictEqual(gitDiff.itemDiffHtml[itemBLine], undefined); // no word-level diff!
    assert.strictEqual(gitDiff.itemDiffHtml[itemALine], undefined); // no word-level diff!
  });

  test('Git Diff Parser — Reordered and Edited Items (Fuzzy Match)', () => {
    const current = `# Open Items\n## Module C\n- [ ] **Item B is edited**\n- [ ] **Item A is edited**`;
    const head = `# Open Items\n## Module C\n- [ ] **Item A**\n- [ ] **Item B**`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    const m = curDoc.modules[0];
    const itemBLine = m.items[0].rawLine; // "Item B is edited"
    const itemALine = m.items[1].rawLine; // "Item A is edited"

    // Both should be marked modified
    assert.strictEqual(gitDiff.itemStatus[itemBLine], 'modified');
    assert.strictEqual(gitDiff.itemStatus[itemALine], 'modified');

    // Due to fuzzy matching, Item B is edited should be diffed against Item B, NOT Item A!
    assert.ok(gitDiff.itemDiffHtml[itemBLine]?.includes('<ins class="git-diff-ins">is</ins>'));
    assert.ok(gitDiff.itemDiffHtml[itemBLine]?.includes('<ins class="git-diff-ins">edited</ins>'));
    assert.ok(!gitDiff.itemDiffHtml[itemBLine]?.includes('<del class="git-diff-del">A</del>'));

    // Item A is edited should be diffed against Item A, NOT Item B!
    assert.ok(gitDiff.itemDiffHtml[itemALine]?.includes('<ins class="git-diff-ins">is</ins>'));
    assert.ok(gitDiff.itemDiffHtml[itemALine]?.includes('<ins class="git-diff-ins">edited</ins>'));
    assert.ok(!gitDiff.itemDiffHtml[itemALine]?.includes('<del class="git-diff-del">B</del>'));
  });

  test('Git Diff Parser — Add New and Delete Old (No Wrong Fuzzy Match)', () => {
    const current = `# Open Items\n## Module D\n- [ ] **test new item**`;
    const head = `# Open Items\n## Module D\n- [x] ~~**FR-API-006 — \`POST /items/\` create**~~ — done (2026-05-15). Validates required fields, returns 201 with \`Location\` header.`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    const m = curDoc.modules[0];
    const testItemLine = m.items[0].rawLine;

    // test new item should be marked added, not modified
    assert.strictEqual(gitDiff.itemStatus[testItemLine], 'added');
    assert.strictEqual(gitDiff.itemDiffHtml[testItemLine], undefined); // no word diff!

    // Check that FR-API-006 is marked deleted
    const deletedList = gitDiff.deletedItems[m.rawLine];
    assert.ok(deletedList);
    assert.strictEqual(deletedList.length, 1);
    assert.ok(deletedList[0].text.includes('FR-API-006'));
  });

  test('Git Diff Parser — Note Diffing', () => {
    const current = `# Open Items\n## Module E\n- [ ] **FR-API-007** — not ciao implemented`;
    const head = `# Open Items\n## Module E\n- [ ] **FR-API-007** — not implemented`;

    const curDoc = parseDocument(current);
    const gitDiff = computeGitDiff(curDoc, head, true, 'modified');

    const m = curDoc.modules[0];
    const itemLine = m.items[0].rawLine;

    // The item should be marked modified (since note changed)
    assert.strictEqual(gitDiff.itemStatus[itemLine], 'modified');

    // The item text is identical, so itemDiffHtml should be undefined
    assert.strictEqual(gitDiff.itemDiffHtml[itemLine], undefined);

    // The note has changed, so itemNoteDiffHtml should contain the diff of the note
    assert.ok(gitDiff.itemNoteDiffHtml[itemLine]?.includes('<ins class="git-diff-ins">ciao</ins>'));
  });
});
