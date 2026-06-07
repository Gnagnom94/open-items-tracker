import * as assert from 'assert';
import { parseDocument } from '../parser';

suite('Parser Test Suite', () => {

  // ── Basic parsing ──────────────────────────────────────────────────────────

  test('parseDocument — empty string', () => {
    const doc = parseDocument('');
    assert.strictEqual(doc.modules.length, 0);
    assert.strictEqual(doc.stats.total, 0);
    assert.strictEqual(doc.stats.done, 0);
    assert.strictEqual(doc.stats.open, 0);
    assert.strictEqual(doc.stats.partial, 0);
    assert.strictEqual(doc.stats.future, 0);
    assert.strictEqual(doc.lastUpdated, undefined);
    assert.strictEqual(doc.filePath, undefined);
  });

  test('parseDocument — filePath preserved', () => {
    const doc = parseDocument('## Module\n- [ ] **Task**', '/some/path.md');
    assert.strictEqual(doc.filePath, '/some/path.md');
  });

  test('parseDocument — lastUpdated extraction', () => {
    const content = 'Last updated: 2026-01-15\n\n## Module\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.lastUpdated, '2026-01-15');
  });

  test('parseDocument — lastUpdated not present', () => {
    const content = '## Module\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.lastUpdated, undefined);
  });

  // ── Module parsing ─────────────────────────────────────────────────────────

  test('parseDocument — single module with items', () => {
    const content = '## Auth Module\n- [ ] **Login**\n- [ ] **Logout**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules.length, 1);
    assert.strictEqual(doc.modules[0].title, 'Auth Module');
    assert.strictEqual(doc.modules[0].rawLine, '## Auth Module');
    assert.strictEqual(doc.modules[0].items.length, 2);
    assert.strictEqual(doc.stats.total, 2);
    assert.strictEqual(doc.stats.open, 2);
  });

  test('parseDocument — multiple modules', () => {
    const content = '## Module A\n- [ ] **Task A**\n\n## Module B\n- [ ] **Task B**\n- [x] ~~**Task C**~~ — done (2026-01-01).';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules.length, 2);
    assert.strictEqual(doc.modules[0].title, 'Module A');
    assert.strictEqual(doc.modules[0].items.length, 1);
    assert.strictEqual(doc.modules[1].title, 'Module B');
    assert.strictEqual(doc.modules[1].items.length, 2);
    assert.strictEqual(doc.stats.total, 3);
    assert.strictEqual(doc.stats.open, 2);
    assert.strictEqual(doc.stats.done, 1);
  });

  test('parseDocument — module context', () => {
    const content = '## Module\nThis is context text.\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].context, 'This is context text.');
  });

  test('parseDocument — module context with multiple lines', () => {
    const content = '## Module\nLine one.\nLine two.\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].context, 'Line one. Line two.');
  });

  test('parseDocument — context skips blank lines and separators', () => {
    const content = '## Module\n\n---\nContext here.\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].context, 'Context here.');
  });

  test('parseDocument — context not captured after subsection', () => {
    const content = '## Module\n### Sub\nThis is not module context.\n- [ ] **Task**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].context, '');
  });

  // ── Sub-section parsing ────────────────────────────────────────────────────

  test('parseDocument — sub-sections', () => {
    const content = '## Module\n### Sub A\n- [ ] **Task A**\n### Sub B\n- [ ] **Task B**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].subSections.length, 2);
    assert.strictEqual(doc.modules[0].subSections[0].title, 'Sub A');
    assert.strictEqual(doc.modules[0].subSections[0].rawLine, '### Sub A');
    assert.strictEqual(doc.modules[0].subSections[0].items.length, 1);
    assert.strictEqual(doc.modules[0].subSections[1].title, 'Sub B');
    assert.strictEqual(doc.modules[0].subSections[1].items.length, 1);
    assert.strictEqual(doc.stats.total, 2);
  });

  test('parseDocument — module items before subsection', () => {
    const content = '## Module\n- [ ] **Root item**\n### Sub\n- [ ] **Sub item**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].items.length, 1);
    assert.strictEqual(doc.modules[0].items[0].text, 'Root item');
    assert.strictEqual(doc.modules[0].subSections[0].items.length, 1);
    assert.strictEqual(doc.modules[0].subSections[0].items[0].text, 'Sub item');
  });

  // ── Item status parsing ────────────────────────────────────────────────────

  test('parseDocument — open item', () => {
    const content = '## M\n- [ ] **My task**';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'My task');
    assert.strictEqual(item.status, 'open');
    assert.strictEqual(item.note, undefined);
    assert.strictEqual(item.date, undefined);
  });

  test('parseDocument — open item with note', () => {
    const content = '## M\n- [ ] **My task** — some note here';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'My task');
    assert.strictEqual(item.status, 'open');
    assert.strictEqual(item.note, 'some note here');
  });

  test('parseDocument — partial item (🔄)', () => {
    const content = '## M\n- [ ] **Partial task** 🔄';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'Partial task');
    assert.strictEqual(item.status, 'partial');
  });

  test('parseDocument — partial item with note', () => {
    const content = '## M\n- [ ] **Partial task** 🔄 — in progress';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'Partial task');
    assert.strictEqual(item.status, 'partial');
    assert.strictEqual(item.note, 'in progress');
  });

  test('parseDocument — future item (🔮)', () => {
    const content = '## M\n- [ ] **Future task** 🔮';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'Future task');
    assert.strictEqual(item.status, 'future');
  });

  test('parseDocument — future item (future phase keyword)', () => {
    const content = '## M\n- [ ] **Later task** — future phase';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.status, 'future');
  });

  test('parseDocument — done item with date', () => {
    const content = '## M\n- [x] ~~**Completed**~~ — done (2026-03-15).';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'Completed');
    assert.strictEqual(item.status, 'done');
    assert.strictEqual(item.date, '2026-03-15');
    assert.strictEqual(item.note, undefined);
  });

  test('parseDocument — done item with date and note', () => {
    const content = '## M\n- [x] ~~**Completed**~~ — done (2026-03-15). A follow-up note.';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'Completed');
    assert.strictEqual(item.status, 'done');
    assert.strictEqual(item.date, '2026-03-15');
    assert.strictEqual(item.note, 'A follow-up note.');
  });

  test('parseDocument — done item without strikethrough bold', () => {
    const content = '## M\n- [x] plain done text';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.status, 'done');
    assert.strictEqual(item.text, 'plain done text');
  });

  // ── Open item without bold ─────────────────────────────────────────────────

  test('parseDocument — open item without bold', () => {
    const content = '## M\n- [ ] plain open text';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'plain open text');
    assert.strictEqual(item.status, 'open');
  });

  test('parseDocument — open item without bold but with dash note', () => {
    const content = '## M\n- [ ] plain text — some note';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    assert.strictEqual(item.text, 'plain text');
    assert.strictEqual(item.note, 'some note');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  test('parseDocument — lines not starting with - [ are ignored', () => {
    const content = '## M\nRandom line\n- Not a checkbox\n- [ ] **Valid**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].items.length, 1);
    assert.strictEqual(doc.modules[0].items[0].text, 'Valid');
  });

  test('parseDocument — no items', () => {
    const content = '## Empty Module';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules.length, 1);
    assert.strictEqual(doc.modules[0].items.length, 0);
    assert.strictEqual(doc.stats.total, 0);
  });

  test('parseDocument — stats aggregation across modules and sub-sections', () => {
    const content = [
      '## Module A',
      '- [ ] **Open 1**',
      '- [x] ~~**Done 1**~~ — done (2026-01-01).',
      '### Sub A1',
      '- [ ] **Open 2** 🔄',
      '- [ ] **Future 1** 🔮',
      '## Module B',
      '- [x] ~~**Done 2**~~ — done (2026-02-01).',
    ].join('\n');

    const doc = parseDocument(content);
    assert.strictEqual(doc.stats.total, 5);
    assert.strictEqual(doc.stats.open, 1);
    assert.strictEqual(doc.stats.done, 2);
    assert.strictEqual(doc.stats.partial, 1);
    assert.strictEqual(doc.stats.future, 1);
  });

  test('parseDocument — items before any module are ignored', () => {
    const content = '- [ ] **Orphan item**\n## Module\n- [ ] **Valid**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules.length, 1);
    assert.strictEqual(doc.modules[0].items.length, 1);
    assert.strictEqual(doc.stats.total, 1);
  });

  test('parseDocument — subsection before any module has items on module when module appears', () => {
    const content = '### Sub\n- [ ] **Orphan sub item**\n## Module\n- [ ] **Valid**';
    const doc = parseDocument(content);
    // The subsection is created but has no parent module, so its items are orphaned
    // The module has only its own items
    assert.strictEqual(doc.modules.length, 1);
    assert.strictEqual(doc.modules[0].items.length, 1);
  });

  test('parseDocument — rawLine is preserved exactly', () => {
    const line = '- [ ] **Task with `code` and special chars <>&**';
    const content = `## M\n${line}`;
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].items[0].rawLine, line);
  });

  // ── Branch coverage: parseItem returns null for non-standard checkbox (L7) ──

  test('parseDocument — non-standard checkbox like - [?] is ignored', () => {
    const content = '## M\n- [?] some weird checkbox\n- [ ] **Valid**';
    const doc = parseDocument(content);
    assert.strictEqual(doc.modules[0].items.length, 1);
    assert.strictEqual(doc.modules[0].items[0].text, 'Valid');
  });

  // ── Branch coverage: note that is only emoji reduces to undefined (L31) ──

  test('parseDocument — open item note containing only emoji becomes undefined', () => {
    const content = '## M\n- [ ] **Task** — 🔄';
    const doc = parseDocument(content);
    const item = doc.modules[0].items[0];
    // The note is "🔄" which after emoji stripping becomes empty → undefined
    assert.strictEqual(item.note, undefined);
  });
});
