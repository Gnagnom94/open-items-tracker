import * as assert from 'assert';
import { escapeHtml, diffTextInline, computeGitDiff } from '../webview/gitDiff';
import { parseDocument } from '../parser';

suite('gitDiff Test Suite', () => {

  // ── escapeHtml ─────────────────────────────────────────────────────────────

  test('escapeHtml — escapes ampersands', () => {
    assert.strictEqual(escapeHtml('A & B'), 'A &amp; B');
  });

  test('escapeHtml — escapes angle brackets', () => {
    assert.strictEqual(escapeHtml('<div>'), '&lt;div&gt;');
  });

  test('escapeHtml — escapes double quotes', () => {
    assert.strictEqual(escapeHtml('a "b" c'), 'a &quot;b&quot; c');
  });

  test('escapeHtml — handles empty string', () => {
    assert.strictEqual(escapeHtml(''), '');
  });

  test('escapeHtml — no special chars unchanged', () => {
    assert.strictEqual(escapeHtml('hello world'), 'hello world');
  });

  test('escapeHtml — multiple special chars', () => {
    assert.strictEqual(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  // ── diffTextInline ─────────────────────────────────────────────────────────

  test('diffTextInline — identical text', () => {
    const result = diffTextInline('same text', 'same text');
    assert.strictEqual(result, 'same text');
  });

  test('diffTextInline — completely different', () => {
    const result = diffTextInline('old', 'new');
    assert.ok(result.includes('<del class="git-diff-del">old</del>'));
    assert.ok(result.includes('<ins class="git-diff-ins">new</ins>'));
  });

  test('diffTextInline — addition at end', () => {
    const result = diffTextInline('hello', 'hello world');
    assert.ok(result.includes('hello'));
    assert.ok(result.includes('<ins class="git-diff-ins">'));
    assert.ok(result.includes('world'));
  });

  test('diffTextInline — deletion at end', () => {
    const result = diffTextInline('hello world', 'hello');
    assert.ok(result.includes('hello'));
    assert.ok(result.includes('<del class="git-diff-del">'));
  });

  test('diffTextInline — empty old', () => {
    const result = diffTextInline('', 'new text');
    assert.ok(result.includes('<ins class="git-diff-ins">'));
  });

  test('diffTextInline — empty new', () => {
    const result = diffTextInline('old text', '');
    assert.ok(result.includes('<del class="git-diff-del">'));
  });

  test('diffTextInline — both empty', () => {
    const result = diffTextInline('', '');
    assert.strictEqual(result, '');
  });

  test('diffTextInline — escapes HTML in text', () => {
    const result = diffTextInline('safe', '<script>alert(1)</script>');
    assert.ok(!result.includes('<script>'));
    assert.ok(result.includes('&lt;'));
  });

  // ── computeGitDiff — edge cases ────────────────────────────────────────────

  test('computeGitDiff — not a repo', () => {
    const doc = parseDocument('## M\n- [ ] **Task**');
    const result = computeGitDiff(doc, undefined, false, 'error');
    assert.strictEqual(result.isRepo, false);
    assert.strictEqual(result.stats.added, 0);
    assert.strictEqual(result.stats.modified, 0);
    assert.strictEqual(result.stats.deleted, 0);
  });

  test('computeGitDiff — error status', () => {
    const doc = parseDocument('## M\n- [ ] **Task**');
    const result = computeGitDiff(doc, 'some content', true, 'error');
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.stats.added, 0);
  });

  test('computeGitDiff — untracked file', () => {
    const doc = parseDocument('## M\n- [ ] **Task A**\n- [ ] **Task B**');
    const result = computeGitDiff(doc, undefined, true, 'untracked');
    assert.strictEqual(result.status, 'untracked');
    assert.strictEqual(result.stats.added, 2);
    assert.strictEqual(result.itemStatus['- [ ] **Task A**'], 'added');
    assert.strictEqual(result.itemStatus['- [ ] **Task B**'], 'added');
  });

  test('computeGitDiff — untracked with sub-sections', () => {
    const content = '## M\n- [ ] **Root**\n### Sub\n- [ ] **Sub item**';
    const doc = parseDocument(content);
    const result = computeGitDiff(doc, undefined, true, 'untracked');
    assert.strictEqual(result.stats.added, 2);
  });

  test('computeGitDiff — clean status', () => {
    const content = '## M\n- [ ] **Task**';
    const doc = parseDocument(content);
    const result = computeGitDiff(doc, content, true, 'clean');
    assert.strictEqual(result.stats.added, 0);
    assert.strictEqual(result.stats.modified, 0);
    assert.strictEqual(result.stats.deleted, 0);
    assert.strictEqual(result.itemStatus['- [ ] **Task**'], 'clean');
  });

  test('computeGitDiff — modified with headContent empty string', () => {
    const doc = parseDocument('## M\n- [ ] **Task**');
    const result = computeGitDiff(doc, '', true, 'modified');
    // Empty headContent → treated like untracked
    assert.strictEqual(result.stats.added, 1); // the single item treated as added
  });

  test('computeGitDiff — new module in current', () => {
    const current = '## Module A\n- [ ] **Item A**\n## Module B\n- [ ] **Item B**';
    const head = '## Module A\n- [ ] **Item A**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    assert.strictEqual(result.itemStatus['- [ ] **Item A**'], 'clean');
    assert.strictEqual(result.itemStatus['- [ ] **Item B**'], 'added');
  });

  test('computeGitDiff — item status changed (text same but checkbox)', () => {
    const current = '## M\n- [x] ~~**Task**~~ — done (2026-01-01).';
    const head = '## M\n- [ ] **Task**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    // Text matches by text extraction, but status differs → modified
    assert.strictEqual(result.itemStatus['- [x] ~~**Task**~~ — done (2026-01-01).'], 'modified');
  });

  test('computeGitDiff — sub-section items diffed', () => {
    const current = '## M\n### Sub\n- [ ] **New item**';
    const head = '## M\n### Sub\n- [ ] **Old item**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    // Items have different text, so one is added and one is deleted
    assert.ok(result.stats.added >= 1 || result.stats.modified >= 1);
  });

  test('computeGitDiff — deleted sub-section items tracked', () => {
    const current = '## M\n### Sub\n- [ ] **Remaining**';
    const head = '## M\n### Sub\n- [ ] **Remaining**\n- [ ] **Removed**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    assert.strictEqual(result.stats.deleted, 1);
    const subRawLine = doc.modules[0].subSections[0].rawLine;
    assert.ok(result.deletedItems[subRawLine]);
    assert.strictEqual(result.deletedItems[subRawLine].length, 1);
    assert.strictEqual(result.deletedItems[subRawLine][0].text, 'Removed');
  });

  test('computeGitDiff — note added generates note diff HTML', () => {
    const current = '## M\n- [ ] **Task** — new note';
    const head = '## M\n- [ ] **Task**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task** — new note';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<ins class="git-diff-ins">'));
  });

  test('computeGitDiff — note removed generates note diff HTML', () => {
    const current = '## M\n- [ ] **Task**';
    const head = '## M\n- [ ] **Task** — old note';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task**';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<del class="git-diff-del">'));
  });

  test('computeGitDiff — note changed generates inline diff', () => {
    const current = '## M\n- [ ] **Task** — new note';
    const head = '## M\n- [ ] **Task** — old note';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task** — new note';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<del class="git-diff-del">'));
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<ins class="git-diff-ins">'));
  });

  test('computeGitDiff — matching by ID', () => {
    const current = '## M\n- [ ] **FR-001 — Updated text**';
    const head = '## M\n- [ ] **FR-001 — Original text**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **FR-001 — Updated text**';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemDiffHtml[rawLine]); // text diff should exist
  });

  test('computeGitDiff — item identical by ID is clean', () => {
    const current = '## M\n- [ ] **FR-001 — Same text**';
    const head = '## M\n- [ ] **FR-001 — Same text**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    assert.strictEqual(result.itemStatus['- [ ] **FR-001 — Same text**'], 'clean');
  });

  // ── Sub-section note diffs ─────────────────────────────────────────────────

  test('computeGitDiff — sub-section item note added', () => {
    const current = '## M\n### S\n- [ ] **Task** — added note';
    const head = '## M\n### S\n- [ ] **Task**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task** — added note';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]);
  });

  test('computeGitDiff — sub-section item note removed', () => {
    const current = '## M\n### S\n- [ ] **Task**';
    const head = '## M\n### S\n- [ ] **Task** — old note';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task**';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<del class="git-diff-del">'));
  });

  test('computeGitDiff — sub-section item note changed', () => {
    const current = '## M\n### S\n- [ ] **Task** — new note';
    const head = '## M\n### S\n- [ ] **Task** — old note';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **Task** — new note';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<ins class="git-diff-ins">'));
    assert.ok(result.itemNoteDiffHtml[rawLine]?.includes('<del class="git-diff-del">'));
  });

  test('computeGitDiff — sub-section item text changed', () => {
    const current = '## M\n### S\n- [ ] **FR-100 — Updated**';
    const head = '## M\n### S\n- [ ] **FR-100 — Original**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **FR-100 — Updated**';
    assert.strictEqual(result.itemStatus[rawLine], 'modified');
    assert.ok(result.itemDiffHtml[rawLine]);
  });

  test('computeGitDiff — sub-section deleted items tracked', () => {
    const current = '## M\n### S\n- [ ] **Kept**';
    const head = '## M\n### S\n- [ ] **Kept**\n- [ ] **Removed**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const subRawLine = doc.modules[0].subSections[0].rawLine;
    assert.ok(result.deletedItems[subRawLine]);
    assert.strictEqual(result.deletedItems[subRawLine].length, 1);
    assert.strictEqual(result.stats.deleted, 1);
  });

  test('computeGitDiff — sub-section added items are counted', () => {
    const current = '## M\n### S\n- [ ] **New item**';
    const head = '## M\n### S';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    const rawLine = '- [ ] **New item**';
    assert.strictEqual(result.itemStatus[rawLine], 'added');
    assert.strictEqual(result.stats.added, 1);
  });

  test('computeGitDiff — new sub-section in current (no match in HEAD)', () => {
    const current = '## M\n### Existing\n- [ ] **Old**\n### New Sub\n- [ ] **Brand new**';
    const head = '## M\n### Existing\n- [ ] **Old**';
    const doc = parseDocument(current);
    const result = computeGitDiff(doc, head, true, 'modified');
    assert.strictEqual(result.itemStatus['- [ ] **Brand new**'], 'added');
    assert.strictEqual(result.stats.added, 1);
  });
});
