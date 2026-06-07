import * as assert from 'assert';
import {
  toggleItem, changeItemStatus, editItemText, editItemNote,
  editHeader, editModuleContext, addItem, deleteItem,
  addModule, deleteModule, addSubSection, deleteSubSection,
  reorderItems, reorderModules, reorderSubSections
} from '../fileTransforms';

suite('fileTransforms Test Suite', () => {

  // ── toggleItem ─────────────────────────────────────────────────────────────

  test('toggleItem — open to done', () => {
    const lines = ['## M', '- [ ] **My task**'];
    const result = toggleItem('- [ ] **My task**')(lines);
    assert.ok(result[1].startsWith('- [x] ~~**My task**~~ — done ('));
    assert.ok(result[1].endsWith(').'));
  });

  test('toggleItem — open with note to done', () => {
    const lines = ['## M', '- [ ] **My task** — some note'];
    const result = toggleItem('- [ ] **My task** — some note')(lines);
    assert.ok(result[1].includes('~~**My task**~~'));
    assert.ok(result[1].includes('some note'));
    assert.ok(result[1].includes('done ('));
  });

  test('toggleItem — done to open', () => {
    const lines = ['## M', '- [x] ~~**Completed**~~ — done (2026-01-01).'];
    const result = toggleItem('- [x] ~~**Completed**~~ — done (2026-01-01).')(lines);
    assert.strictEqual(result[1], '- [ ] **Completed**');
  });

  test('toggleItem — done with note to open', () => {
    const lines = ['## M', '- [x] ~~**Completed**~~ — done (2026-01-01). A note here.'];
    const result = toggleItem('- [x] ~~**Completed**~~ — done (2026-01-01). A note here.')(lines);
    assert.strictEqual(result[1], '- [ ] **Completed** — A note here.');
  });

  test('toggleItem — rawLine not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **Task A**'];
    const result = toggleItem('- [ ] **Task B**')(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('toggleItem — partial item toggled to done', () => {
    const lines = ['## M', '- [ ] **Partial** 🔄'];
    const result = toggleItem('- [ ] **Partial** 🔄')(lines);
    assert.ok(result[1].startsWith('- [x] ~~**Partial**~~ — done ('));
  });

  // ── changeItemStatus ───────────────────────────────────────────────────────

  test('changeItemStatus — open to partial', () => {
    const lines = ['## M', '- [ ] **Task**'];
    const result = changeItemStatus('- [ ] **Task**', 'partial')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** 🔄');
  });

  test('changeItemStatus — open to future', () => {
    const lines = ['## M', '- [ ] **Task**'];
    const result = changeItemStatus('- [ ] **Task**', 'future')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** 🔮');
  });

  test('changeItemStatus — open to done', () => {
    const lines = ['## M', '- [ ] **Task**'];
    const result = changeItemStatus('- [ ] **Task**', 'done')(lines);
    assert.ok(result[1].startsWith('- [x] ~~**Task**~~ — done ('));
  });

  test('changeItemStatus — done to open', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — done (2026-01-01).'];
    const result = changeItemStatus('- [x] ~~**Task**~~ — done (2026-01-01).', 'open')(lines);
    assert.strictEqual(result[1], '- [ ] **Task**');
  });

  test('changeItemStatus — done to partial', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — done (2026-01-01).'];
    const result = changeItemStatus('- [x] ~~**Task**~~ — done (2026-01-01).', 'partial')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** 🔄');
  });

  test('changeItemStatus — open with note to partial', () => {
    const lines = ['## M', '- [ ] **Task** — my note'];
    const result = changeItemStatus('- [ ] **Task** — my note', 'partial')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** 🔄 — my note');
  });

  test('changeItemStatus — open with note to done', () => {
    const lines = ['## M', '- [ ] **Task** — my note'];
    const result = changeItemStatus('- [ ] **Task** — my note', 'done')(lines);
    assert.ok(result[1].includes('~~**Task**~~'));
    assert.ok(result[1].includes('my note'));
  });

  test('changeItemStatus — open with note to future', () => {
    const lines = ['## M', '- [ ] **Task** — my note'];
    const result = changeItemStatus('- [ ] **Task** — my note', 'future')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** 🔮 — my note');
  });

  test('changeItemStatus — not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = changeItemStatus('- [ ] **B**', 'done')(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('changeItemStatus — done with note to open', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — done (2026-01-01). Note text'];
    const result = changeItemStatus('- [x] ~~**Task**~~ — done (2026-01-01). Note text', 'open')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** — Note text');
  });

  // ── editItemText ───────────────────────────────────────────────────────────

  test('editItemText — open item with bold', () => {
    const lines = ['## M', '- [ ] **Old text**'];
    const result = editItemText('- [ ] **Old text**', 'New text')(lines);
    assert.strictEqual(result[1], '- [ ] **New text**');
  });

  test('editItemText — done item', () => {
    const lines = ['## M', '- [x] ~~**Old text**~~ — done (2026-01-01).'];
    const result = editItemText('- [x] ~~**Old text**~~ — done (2026-01-01).', 'New text')(lines);
    assert.strictEqual(result[1], '- [x] ~~**New text**~~ — done (2026-01-01).');
  });

  test('editItemText — item without bold', () => {
    const lines = ['## M', '- [ ] plain text — note'];
    const result = editItemText('- [ ] plain text — note', 'New text')(lines);
    assert.strictEqual(result[1], '- [ ] **New text** — note');
  });

  test('editItemText — item without bold and no note', () => {
    const lines = ['## M', '- [ ] plain text'];
    const result = editItemText('- [ ] plain text', 'New text')(lines);
    assert.strictEqual(result[1], '- [ ] **New text**');
  });

  test('editItemText — not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = editItemText('- [ ] **B**', 'C')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── editItemNote ───────────────────────────────────────────────────────────

  test('editItemNote — add note to open item without note', () => {
    const lines = ['## M', '- [ ] **Task**'];
    const result = editItemNote('- [ ] **Task**', 'new note')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** — new note');
  });

  test('editItemNote — replace note on open item', () => {
    const lines = ['## M', '- [ ] **Task** — old note'];
    const result = editItemNote('- [ ] **Task** — old note', 'new note')(lines);
    assert.strictEqual(result[1], '- [ ] **Task** — new note');
  });

  test('editItemNote — remove note from open item', () => {
    const lines = ['## M', '- [ ] **Task** — old note'];
    const result = editItemNote('- [ ] **Task** — old note', '')(lines);
    assert.strictEqual(result[1], '- [ ] **Task**');
  });

  test('editItemNote — edit note on done item with standard format', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — done (2026-01-01). Old note.'];
    const result = editItemNote('- [x] ~~**Task**~~ — done (2026-01-01). Old note.', 'New note.')(lines);
    assert.strictEqual(result[1], '- [x] ~~**Task**~~ — done (2026-01-01). New note.');
  });

  test('editItemNote — remove note from done item', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — done (2026-01-01). Old note.'];
    const result = editItemNote('- [x] ~~**Task**~~ — done (2026-01-01). Old note.', '')(lines);
    assert.strictEqual(result[1], '- [x] ~~**Task**~~ — done (2026-01-01).');
  });

  test('editItemNote — done item without standard format uses dash', () => {
    const lines = ['## M', '- [x] ~~**Task**~~ — some non-standard'];
    const result = editItemNote('- [x] ~~**Task**~~ — some non-standard', 'updated')(lines);
    assert.strictEqual(result[1], '- [x] ~~**Task**~~ — updated');
  });

  test('editItemNote — done item without any dash', () => {
    const lines = ['## M', '- [x] ~~**Task**~~'];
    const result = editItemNote('- [x] ~~**Task**~~', 'a note')(lines);
    assert.strictEqual(result[1], '- [x] ~~**Task**~~ — a note');
  });

  test('editItemNote — not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = editItemNote('- [ ] **B**', 'note')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── editHeader ─────────────────────────────────────────────────────────────

  test('editHeader — module header (##)', () => {
    const lines = ['## Old Title', '- [ ] **Task**'];
    const result = editHeader('## Old Title', 'New Title')(lines);
    assert.strictEqual(result[0], '## New Title');
  });

  test('editHeader — sub-section header (###)', () => {
    const lines = ['## Module', '### Old Sub', '- [ ] **Task**'];
    const result = editHeader('### Old Sub', 'New Sub')(lines);
    assert.strictEqual(result[1], '### New Sub');
  });

  test('editHeader — not found returns unchanged', () => {
    const lines = ['## A'];
    const result = editHeader('## B', 'C')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── editModuleContext ──────────────────────────────────────────────────────

  test('editModuleContext — replace existing context', () => {
    const lines = ['## Module', 'Old context line', '- [ ] **Task**'];
    const result = editModuleContext('## Module', 'New context')(lines);
    assert.strictEqual(result[1], 'New context');
    assert.strictEqual(result[2], '- [ ] **Task**');
  });

  test('editModuleContext — add context when none exists', () => {
    const lines = ['## Module', '- [ ] **Task**'];
    const result = editModuleContext('## Module', 'New context')(lines);
    assert.strictEqual(result[1], '');
    assert.strictEqual(result[2], 'New context');
    assert.strictEqual(result[3], '- [ ] **Task**');
  });

  test('editModuleContext — context skips blank lines and separators', () => {
    const lines = ['## Module', '', '---', 'Context here', '- [ ] **Task**'];
    const result = editModuleContext('## Module', 'Updated context')(lines);
    assert.strictEqual(result[3], 'Updated context');
  });

  test('editModuleContext — not found returns unchanged', () => {
    const lines = ['## A', '- [ ] **Task**'];
    const result = editModuleContext('## B', 'ctx')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  test('addItem — to module (after existing items)', () => {
    const lines = ['## Module', '- [ ] **Item 1**', '- [ ] **Item 2**'];
    const result = addItem('## Module', 'Item 3')(lines);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[3], '- [ ] **Item 3**');
  });

  test('addItem — to module (no existing items)', () => {
    const lines = ['## Module'];
    const result = addItem('## Module', 'First item')(lines);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1], '- [ ] **First item**');
  });

  test('addItem — to sub-section (after items)', () => {
    const lines = ['## Module', '### Sub', '- [ ] **Sub item 1**', '### Sub 2'];
    const result = addItem('### Sub', 'Sub item 2')(lines);
    assert.strictEqual(result.length, 5);
    assert.strictEqual(result[3], '- [ ] **Sub item 2**');
  });

  test('addItem — to sub-section (no existing items)', () => {
    const lines = ['## Module', '### Sub', '### Sub 2'];
    const result = addItem('### Sub', 'New item')(lines);
    assert.strictEqual(result.length, 4);
    assert.strictEqual(result[2], '- [ ] **New item**');
  });

  test('addItem — parent not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = addItem('## Missing', 'B')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── deleteItem ─────────────────────────────────────────────────────────────

  test('deleteItem — removes matching line', () => {
    const lines = ['## M', '- [ ] **Task A**', '- [ ] **Task B**'];
    const result = deleteItem('- [ ] **Task A**')(lines);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1], '- [ ] **Task B**');
  });

  test('deleteItem — not found returns unchanged', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = deleteItem('- [ ] **B**')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── addModule ──────────────────────────────────────────────────────────────

  test('addModule — appends new module', () => {
    const lines = ['## Module A', '- [ ] **Task**'];
    const result = addModule('Module B')(lines);
    assert.ok(result.includes('## Module B'));
    assert.ok(result.includes('---'));
  });

  test('addModule — trims trailing empty lines', () => {
    const lines = ['## Module A', '- [ ] **Task**', '', '', ''];
    const result = addModule('Module B')(lines);
    // After trimming blanks, then adding module block
    const moduleIdx = result.indexOf('## Module B');
    assert.ok(moduleIdx > 0);
    // Should not have more than 2 blank lines before the separator
  });

  // ── deleteModule ───────────────────────────────────────────────────────────

  test('deleteModule — removes module and its content', () => {
    const lines = ['## Module A', '- [ ] **Task A**', '## Module B', '- [ ] **Task B**'];
    const result = deleteModule('## Module A')(lines);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], '## Module B');
    assert.strictEqual(result[1], '- [ ] **Task B**');
  });

  test('deleteModule — removes last module', () => {
    const lines = ['## Module A', '- [ ] **Task A**'];
    const result = deleteModule('## Module A')(lines);
    assert.strictEqual(result.length, 0);
  });

  test('deleteModule — trims blank lines after deletion', () => {
    const lines = ['## Module A', '- [ ] **Task A**', '', '', '## Module B', '- [ ] **Task B**'];
    const result = deleteModule('## Module A')(lines);
    assert.strictEqual(result[0], '## Module B');
  });

  test('deleteModule — not found returns unchanged', () => {
    const lines = ['## A'];
    const result = deleteModule('## B')(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('deleteModule — trims multiple consecutive blank lines after deletion', () => {
    const lines = ['## Module A', '- [ ] **Task A**', '', '', '', '## Module B', '- [ ] **Task B**'];
    const result = deleteModule('## Module A')(lines);
    assert.strictEqual(result[0], '## Module B');
    assert.strictEqual(result[1], '- [ ] **Task B**');
    assert.strictEqual(result.length, 2);
  });

  test('deleteModule — trims trailing blank lines when deleting last module', () => {
    const lines = ['Preamble', '', '## Last Module', '- [ ] **Task**', '', ''];
    const result = deleteModule('## Last Module')(lines);
    // Module was at index 2, splice removes from 2 to end (6), leaving ['Preamble', '']
    // Then blank at index 2 (if any) gets trimmed. After splice, index 2 is empty -> trim
    assert.ok(!result.some((l, i) => i >= 2 && l.trim() === ''), 'No trailing blanks after deletion');
  });

  test('deleteModule — first module deleted leaves blank lines to trim before second', () => {
    // Scenario: first module, then separator line, blank line, second module
    const lines = ['## First', '- [ ] **A**', '', '## Second', '- [ ] **B**'];
    const result = deleteModule('## First')(lines);
    assert.strictEqual(result[0], '## Second');
  });

  // ── addSubSection ──────────────────────────────────────────────────────────

  test('addSubSection — adds sub-section to module', () => {
    const lines = ['## Module', '- [ ] **Task**', '', '## Module B'];
    const result = addSubSection('## Module', 'New Sub')(lines);
    assert.ok(result.includes('### New Sub'));
  });

  test('addSubSection — not found returns unchanged', () => {
    const lines = ['## A'];
    const result = addSubSection('## B', 'Sub')(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── deleteSubSection ───────────────────────────────────────────────────────

  test('deleteSubSection — removes sub-section and items', () => {
    const lines = ['## Module', '### Sub A', '- [ ] **Task A**', '### Sub B', '- [ ] **Task B**'];
    const result = deleteSubSection('### Sub A')(lines);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0], '## Module');
    assert.strictEqual(result[1], '### Sub B');
  });

  test('deleteSubSection — removes last sub-section', () => {
    const lines = ['## Module', '### Sub A', '- [ ] **Task A**'];
    const result = deleteSubSection('### Sub A')(lines);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], '## Module');
  });

  test('deleteSubSection — not found returns unchanged', () => {
    const lines = ['## M', '### A'];
    const result = deleteSubSection('### B')(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('deleteSubSection — trims multiple blank lines after deletion', () => {
    const lines = ['## Module', '### Sub A', '- [ ] **Task A**', '', '', '### Sub B', '- [ ] **Task B**'];
    const result = deleteSubSection('### Sub A')(lines);
    assert.strictEqual(result[0], '## Module');
    assert.strictEqual(result[1], '### Sub B');
    assert.strictEqual(result[2], '- [ ] **Task B**');
  });

  test('deleteSubSection — trims trailing blank lines when deleting last sub-section', () => {
    const lines = ['## Module', '### Only Sub', '- [ ] **Task**', '', ''];
    const result = deleteSubSection('### Only Sub')(lines);
    assert.strictEqual(result[0], '## Module');
    // Should not have blank lines at index 1+
    assert.ok(result.length <= 1 || result.every((l, i) => i === 0 || l.trim() !== ''), 'No trailing blanks');
  });

  // ── reorderItems ───────────────────────────────────────────────────────────

  test('reorderItems — reorders items in place', () => {
    const lines = ['## M', '- [ ] **A**', '- [ ] **B**', '- [ ] **C**'];
    const oldOrder = ['- [ ] **A**', '- [ ] **B**', '- [ ] **C**'];
    const newOrder = ['- [ ] **C**', '- [ ] **A**', '- [ ] **B**'];
    const result = reorderItems(oldOrder, newOrder)(lines);
    assert.strictEqual(result[1], '- [ ] **C**');
    assert.strictEqual(result[2], '- [ ] **A**');
    assert.strictEqual(result[3], '- [ ] **B**');
  });

  test('reorderItems — length mismatch returns original', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = reorderItems(['- [ ] **A**'], ['- [ ] **A**', '- [ ] **B**'])(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('reorderItems — item not found in lines returns copy', () => {
    const lines = ['## M', '- [ ] **A**'];
    const result = reorderItems(['- [ ] **Missing**'], ['- [ ] **A**'])(lines);
    // Indices length won't match newOrder length, returns result as-is
    assert.deepStrictEqual(result, lines);
  });

  // ── reorderModules ─────────────────────────────────────────────────────────

  test('reorderModules — reorders module blocks', () => {
    const lines = ['# Title', '', '## Module A', '- [ ] **A**', '## Module B', '- [ ] **B**'];
    const oldOrder = ['## Module A', '## Module B'];
    const newOrder = ['## Module B', '## Module A'];
    const result = reorderModules(oldOrder, newOrder)(lines);
    assert.strictEqual(result[2], '## Module B');
    assert.strictEqual(result[3], '- [ ] **B**');
    assert.strictEqual(result[4], '## Module A');
    assert.strictEqual(result[5], '- [ ] **A**');
  });

  test('reorderModules — length mismatch returns original', () => {
    const lines = ['## A'];
    const result = reorderModules(['## A'], ['## A', '## B'])(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('reorderModules — no modules returns original', () => {
    const lines = ['# No modules here'];
    const result = reorderModules([], [])(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── reorderSubSections ─────────────────────────────────────────────────────

  test('reorderSubSections — reorders sub-section blocks', () => {
    const lines = [
      '## Module',
      '- [ ] **Root item**',
      '### Sub A',
      '- [ ] **A item**',
      '### Sub B',
      '- [ ] **B item**',
    ];
    const oldOrder = ['### Sub A', '### Sub B'];
    const newOrder = ['### Sub B', '### Sub A'];
    const result = reorderSubSections('## Module', oldOrder, newOrder)(lines);
    const subBIdx = result.indexOf('### Sub B');
    const subAIdx = result.indexOf('### Sub A');
    assert.ok(subBIdx < subAIdx, 'Sub B should come before Sub A after reorder');
  });

  test('reorderSubSections — length mismatch returns original', () => {
    const lines = ['## Module', '### Sub A'];
    const result = reorderSubSections('## Module', ['### Sub A'], ['### Sub A', '### Sub B'])(lines);
    assert.deepStrictEqual(result, lines);
  });

  test('reorderSubSections — module not found returns original', () => {
    const lines = ['## Module', '### Sub A'];
    const result = reorderSubSections('## Missing', ['### Sub A'], ['### Sub A'])(lines);
    assert.deepStrictEqual(result, lines);
  });

  // ── Edge cases for toggleItem ──────────────────────────────────────────────

  test('toggleItem — done item without strikethrough bold uses fallback text extraction', () => {
    const lines = ['## M', '- [x] plain done text'];
    const result = toggleItem('- [x] plain done text')(lines);
    assert.strictEqual(result[1], '- [ ] **plain done text**');
  });

  // ── Branch coverage: extractFromOpen without bold, with dash (L40) ──

  test('toggleItem — open item without bold but with dash uses content before dash', () => {
    const lines = ['## M', '- [ ] plain text — my note'];
    const result = toggleItem('- [ ] plain text — my note')(lines);
    assert.ok(result[1].includes('~~**plain text**~~'));
    assert.ok(result[1].includes('my note'));
  });

  // ── Branch coverage: extractFromOpen emoji-only note becomes undefined (L43) ──

  test('toggleItem — open item whose note is only emoji produces no note in done format', () => {
    const lines = ['## M', '- [ ] **Task** — 🔄'];
    const result = toggleItem('- [ ] **Task** — 🔄')(lines);
    // Note " 🔄" after emoji strip is empty → treated as no note
    assert.ok(result[1].includes('~~**Task**~~'));
    assert.ok(!result[1].includes('🔄'));
    // Should end with "done (YYYY-MM-DD)." without trailing note
    assert.ok(result[1].match(/done \(\d{4}-\d{2}-\d{2}\)\.$/));
  });

  // ── Branch coverage: editItemNote done item fallback (no date match) (L132) ──

  test('editItemNote — done item without date pattern, remove note via empty string', () => {
    // This done item doesn't match the standard "— done (YYYY-MM-DD)." pattern
    // so it falls through to the dashIdx fallback
    const lines = ['## M', '- [x] ~~**Task**~~ — manual completion'];
    const result = editItemNote('- [x] ~~**Task**~~ — manual completion', '')(lines);
    assert.strictEqual(result[1], '- [x] ~~**Task**~~');
  });

  // ── Branch coverage: editHeader without hash prefix → ?? fallback (L150) ──

  test('editHeader — rawLine without leading hash uses default "## " prefix', () => {
    // A line that exists in the array but doesn't start with #
    const lines = ['NoHashTitle', '- [ ] **Task**'];
    const result = editHeader('NoHashTitle', 'New Title')(lines);
    assert.strictEqual(result[0], '## New Title');
  });

  // ── Branch coverage: extractFromOpen no bold, no dash → use full content (L40) ──

  test('toggleItem — open item without bold and without dash uses full content as text', () => {
    const lines = ['## M', '- [ ] plain text without dash'];
    const result = toggleItem('- [ ] plain text without dash')(lines);
    assert.ok(result[1].includes('~~**plain text without dash**~~'));
    assert.ok(result[1].includes('done ('));
  });
});
