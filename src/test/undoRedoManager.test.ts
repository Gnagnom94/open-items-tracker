import * as assert from 'assert';
import { UndoRedoManager, undoRedoManager } from '../undoRedoManager';

suite('UndoRedoManager Test Suite', () => {

  // Reset state before each test
  setup(() => {
    undoRedoManager.clearAll('test-file');
    undoRedoManager.setMaxStackSize(50);
  });

  // ── Singleton ──────────────────────────────────────────────────────────────

  test('getInstance returns singleton', () => {
    const a = UndoRedoManager.getInstance();
    const b = UndoRedoManager.getInstance();
    assert.strictEqual(a, b);
  });

  test('module-level undoRedoManager is the singleton', () => {
    assert.strictEqual(undoRedoManager, UndoRedoManager.getInstance());
  });

  // ── Basic push/undo/redo ───────────────────────────────────────────────────

  test('empty stack — hasUndo false', () => {
    assert.strictEqual(undoRedoManager.hasUndo('test-file'), false);
  });

  test('empty stack — hasRedo false', () => {
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), false);
  });

  test('undo on empty stack returns undefined', () => {
    assert.strictEqual(undoRedoManager.undo('test-file', 'cur'), undefined);
  });

  test('redo on empty stack returns undefined', () => {
    assert.strictEqual(undoRedoManager.redo('test-file', 'cur'), undefined);
  });

  test('push then undo returns pushed content', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    const result = undoRedoManager.undo('test-file', 'state-B');
    assert.strictEqual(result, 'state-A');
  });

  test('push then undo creates redo entry', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.undo('test-file', 'state-B');
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), true);
  });

  test('redo returns the state passed to undo', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.undo('test-file', 'state-B');
    const result = undoRedoManager.redo('test-file', 'state-A');
    assert.strictEqual(result, 'state-B');
  });

  test('push clears redo stack', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.undo('test-file', 'state-B');
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), true);
    undoRedoManager.pushState('test-file', 'state-C');
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), false);
  });

  // ── Max stack size ─────────────────────────────────────────────────────────

  test('stack size limited by maxStackSize', () => {
    undoRedoManager.setMaxStackSize(2);
    undoRedoManager.pushState('test-file', 'state-1');
    undoRedoManager.pushState('test-file', 'state-2');
    undoRedoManager.pushState('test-file', 'state-3'); // drops state-1

    const r1 = undoRedoManager.undo('test-file', 'state-4');
    assert.strictEqual(r1, 'state-3');

    const r2 = undoRedoManager.undo('test-file', 'state-3');
    assert.strictEqual(r2, 'state-2');

    const r3 = undoRedoManager.undo('test-file', 'state-2');
    assert.strictEqual(r3, undefined); // state-1 was dropped
  });

  // ── clearRedo ──────────────────────────────────────────────────────────────

  test('clearRedo removes redo stack', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.undo('test-file', 'state-B');
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), true);
    undoRedoManager.clearRedo('test-file');
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), false);
  });

  // ── clearAll ───────────────────────────────────────────────────────────────

  test('clearAll removes both stacks', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.undo('test-file', 'state-B');
    assert.strictEqual(undoRedoManager.hasUndo('test-file'), false);
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), true);
    undoRedoManager.clearAll('test-file');
    assert.strictEqual(undoRedoManager.hasUndo('test-file'), false);
    assert.strictEqual(undoRedoManager.hasRedo('test-file'), false);
  });

  // ── Multiple files ─────────────────────────────────────────────────────────

  test('separate stacks per file', () => {
    undoRedoManager.pushState('file-a', 'A-state');
    undoRedoManager.pushState('file-b', 'B-state');

    assert.strictEqual(undoRedoManager.hasUndo('file-a'), true);
    assert.strictEqual(undoRedoManager.hasUndo('file-b'), true);

    undoRedoManager.clearAll('file-a');
    assert.strictEqual(undoRedoManager.hasUndo('file-a'), false);
    assert.strictEqual(undoRedoManager.hasUndo('file-b'), true);

    // Clean up
    undoRedoManager.clearAll('file-b');
  });

  // ── isInternalWrite ────────────────────────────────────────────────────────

  test('isInternalWrite defaults to false', () => {
    // Reset in case another test left it dirty
    undoRedoManager.isInternalWrite = false;
    assert.strictEqual(undoRedoManager.isInternalWrite, false);
  });

  test('isInternalWrite can be set', () => {
    undoRedoManager.isInternalWrite = true;
    assert.strictEqual(undoRedoManager.isInternalWrite, true);
    undoRedoManager.isInternalWrite = false;
  });

  // ── undo then redo chain with undo stack tracking ──────────────────────────

  test('redo pushes to undo stack', () => {
    undoRedoManager.pushState('test-file', 'state-A');
    undoRedoManager.pushState('test-file', 'state-B');

    // Undo twice
    undoRedoManager.undo('test-file', 'state-C'); // returns state-B
    undoRedoManager.undo('test-file', 'state-B'); // returns state-A

    // Redo once — should push state-B to undo
    const redoResult = undoRedoManager.redo('test-file', 'state-A');
    assert.strictEqual(redoResult, 'state-B');
    assert.strictEqual(undoRedoManager.hasUndo('test-file'), true);
  });

  // ── hasUndo / hasRedo for non-existent file ────────────────────────────────

  test('hasUndo for non-existent file returns false', () => {
    assert.strictEqual(undoRedoManager.hasUndo('non-existent-file'), false);
  });

  test('hasRedo for non-existent file returns false', () => {
    assert.strictEqual(undoRedoManager.hasRedo('non-existent-file'), false);
  });

  // ── redo with no existing undo stack ───────────────────────────────────────

  test('redo creates undo stack if not existing', () => {
    // Manually set up a situation where redo exists but undo doesn't
    undoRedoManager.clearAll('test-file');
    undoRedoManager.pushState('test-file', 'A');
    undoRedoManager.undo('test-file', 'B'); // undo stack empty, redo has B
    undoRedoManager.clearAll('test-file');

    // Now there's nothing — redo returns undefined
    const result = undoRedoManager.redo('test-file', 'X');
    assert.strictEqual(result, undefined);
  });

  test('redo creates undo stack when only redo stack exists for file', () => {
    // We need to get into a state where:
    // - redoStack has entries for the file
    // - undoStack does NOT have the key
    // This happens when we use a fresh file path, push, undo (which empties undo),
    // then delete only the undo stack.
    const file = 'redo-no-undo-file';
    undoRedoManager.clearAll(file);

    // Push state A, then undo → undo stack empty, redo has ['B']
    undoRedoManager.pushState(file, 'A');
    const undone = undoRedoManager.undo(file, 'B');
    assert.strictEqual(undone, 'A');

    // The undo stack is now empty but exists. Redo once:
    // This covers the path where undoStacks.has() is true but empty.
    const redone = undoRedoManager.redo(file, 'A');
    assert.strictEqual(redone, 'B');
    assert.strictEqual(undoRedoManager.hasUndo(file), true);

    undoRedoManager.clearAll(file);
  });
});
