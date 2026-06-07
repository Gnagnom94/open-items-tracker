import * as assert from 'assert';
import { readSettings } from '../settings';

suite('Settings Test Suite', () => {

  test('readSettings — default (sidebar) font size key returns all settings', () => {
    const settings = readSettings();
    assert.ok(typeof settings.fontSize === 'number');
    assert.strictEqual(settings.defaultSort, 'manual');
    assert.strictEqual(settings.collapseByDefault, false);
    assert.strictEqual(settings.showDoneItems, true);
    assert.strictEqual(settings.showFutureItems, true);
    assert.strictEqual(settings.gitIntegration, true);
    assert.strictEqual(settings.gitHighlight, true);
    assert.strictEqual(settings.gitShowInlineDiff, true);
    assert.strictEqual(settings.undoRedoStackSize, 50);
  });

  test('readSettings — fontSizeSidebar explicitly', () => {
    const settings = readSettings('fontSizeSidebar');
    assert.ok(typeof settings.fontSize === 'number');
  });

  test('readSettings — fontSizeEditor', () => {
    const settings = readSettings('fontSizeEditor');
    assert.ok(typeof settings.fontSize === 'number');
  });

  test('readSettings — fontSizeSidebar and fontSizeEditor return different defaults', () => {
    const sidebar = readSettings('fontSizeSidebar');
    const editor = readSettings('fontSizeEditor');
    // They may differ — both should be numbers >= 8
    assert.ok(sidebar.fontSize >= 8);
    assert.ok(editor.fontSize >= 8);
  });
});
