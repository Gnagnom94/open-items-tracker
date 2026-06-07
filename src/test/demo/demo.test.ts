// ── Demo Scenarios — Automated GIF Recording ────────────────────────────────
// Each test block records one feature GIF for the README.
// Run via: npm run record-demos (NOT part of the normal test suite).

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DemoRecorder, wait } from './recorder';

// ── Configuration ───────────────────────────────────────────────────────────

const OUTPUT_DIR = process.env.DEMO_OUTPUT_DIR || path.join(__dirname, '..', '..', '..', 'media', 'demos');
const WORKSPACE_PATH = process.env.DEMO_WORKSPACE_PATH || '';
const OPEN_ITEMS_PATH = path.join(WORKSPACE_PATH, 'docs', 'open-items.md');

// Scenario filter: comma-separated list of scenario names, or empty for all
const SCENARIO_FILTER = (process.env.DEMO_SCENARIOS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/** Check if a scenario should be recorded (empty filter = record all). */
function shouldRecord(name: string): boolean {
  return SCENARIO_FILTER.length === 0 || SCENARIO_FILTER.includes(name);
}

const GIF_WIDTH_EDITOR = 960;
const GIF_FPS = 12;
const RECORD_FPS = 15;

// ── Helpers ─────────────────────────────────────────────────────────────────

const recorder = new DemoRecorder(OUTPUT_DIR);

/** Send a demo:* message to the active webview panel. */
async function demoMessage(msg: Record<string, unknown>): Promise<void> {
  await vscode.commands.executeCommand('openItemsTracker._demoMessage', msg);
}

/** Read the current open-items.md content. */
function readOpenItems(): string {
  return fs.readFileSync(OPEN_ITEMS_PATH, 'utf8');
}

/** Write content to open-items.md (triggers auto-refresh in the webview). */
function writeOpenItems(content: string): void {
  fs.writeFileSync(OPEN_ITEMS_PATH, content, 'utf8');
}

/** Open the open-items.md file in the custom editor panel. */
async function openPanel(): Promise<void> {
  const uri = vscode.Uri.file(OPEN_ITEMS_PATH);
  await vscode.commands.executeCommand('vscode.openWith', uri, 'openItemsTracker.markdownEditor');
  await wait(2000); // Wait for webview to render
}

/** Record a scenario: start recording, run actions, stop, convert to GIF. */
async function recordScenario(
  name: string,
  width: number,
  actions: () => Promise<void>
): Promise<void> {
  await wait(500);

  recorder.startRecording(name, RECORD_FPS);
  try {
    await wait(800);
    await actions();
    await wait(800);
  } finally {
    await recorder.stopRecording();
  }

  recorder.convertToGif(name, width, GIF_FPS);
}

// ── Test Suite ───────────────────────────────────────────────────────────────

suite('Demo Recordings', function () {
  this.timeout(120_000);

  suiteSetup(async function () {
    if (!WORKSPACE_PATH || !fs.existsSync(OPEN_ITEMS_PATH)) {
      throw new Error(
        'Demo workspace not found. Run via: npm run record-demos\n' +
        `  WORKSPACE_PATH=${WORKSPACE_PATH}\n` +
        `  OPEN_ITEMS_PATH=${OPEN_ITEMS_PATH}`
      );
    }

    // Explicitly activate the extension
    const ext = vscode.extensions.getExtension('Gnagnom94.open-items-tracker');
    if (ext && !ext.isActive) {
      console.log('  Activating extension...');
      await ext.activate();
    }
    if (!ext) {
      throw new Error('Extension Gnagnom94.open-items-tracker not found');
    }

    // Wait for window to settle, then find its position
    await wait(4000);
    const rect = recorder.findWindow();
    console.log(`  Window rect: ${rect.x},${rect.y} ${rect.width}x${rect.height}`);

    // Open the panel
    await openPanel();
    await wait(1000);
  });

  suiteTeardown(async function () {
    await wait(1000);
    try { recorder.cleanupMp4Files(); } catch { /* ignore locked files */ }
  });

  // ── Scenario 1: Stats Dashboard ─────────────────────────────────────────

  test('stats-dashboard', async function () {
    if (!shouldRecord('stats-dashboard')) { return this.skip(); }
    console.log('  🎬 Recording: stats-dashboard');
    await openPanel();

    await recordScenario('stats-dashboard', GIF_WIDTH_EDITOR, async () => {
      // Just show the fully loaded dashboard
      await wait(3000);
    });
  });

  // ── Scenario 2: Checkbox Toggle ─────────────────────────────────────────

  test('checkbox-toggle', async function () {
    if (!shouldRecord('checkbox-toggle')) { return this.skip(); }
    console.log('  🎬 Recording: checkbox-toggle');
    await openPanel();

    await recordScenario('checkbox-toggle', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Toggle "Dark mode preference sync" to done
      const toggled1 = content.replace(
        '- [ ] **Dark mode preference sync** — not implemented.',
        '- [x] ~~**Dark mode preference sync**~~ — done (2025-12-15).'
      );
      writeOpenItems(toggled1);
      await wait(2000);

      // Toggle "Profile avatar upload" to done
      const toggled2 = toggled1.replace(
        '- [ ] **Profile avatar upload** — not implemented.',
        '- [x] ~~**Profile avatar upload**~~ — done (2025-12-15).'
      );
      writeOpenItems(toggled2);
      await wait(2000);

      // Revert both
      writeOpenItems(content);
      await wait(1500);
    });
  });

  // ── Scenario 3: Status Change ───────────────────────────────────────────

  test('status-change', async function () {
    if (!shouldRecord('status-change')) { return this.skip(); }
    console.log('  🎬 Recording: status-change');
    await openPanel();

    await recordScenario('status-change', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Open → Partial (visible item in User Management)
      const partial = content.replace(
        '- [ ] **Dark mode preference sync** — not implemented.',
        '- [ ] **Dark mode preference sync** 🔄 — backend ready, frontend pending.'
      );
      writeOpenItems(partial);
      await wait(2000);

      // Partial → Done
      const done = partial.replace(
        '- [ ] **Dark mode preference sync** 🔄 — backend ready, frontend pending.',
        '- [x] ~~**Dark mode preference sync**~~ — done (2025-12-15).'
      );
      writeOpenItems(done);
      await wait(2000);

      // Revert
      writeOpenItems(content);
      await wait(1500);
    });
  });

  // ── Scenario 4: Add & Delete ────────────────────────────────────────────

  test('add-delete', async function () {
    if (!shouldRecord('add-delete')) { return this.skip(); }
    console.log('  🎬 Recording: add-delete');
    await openPanel();

    await recordScenario('add-delete', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Add a new item to User Management
      const withItem = content.replace(
        '- [ ] **Profile avatar upload** — not implemented.',
        '- [ ] **Profile avatar upload** — not implemented.\n- [ ] **Email notification preferences** — allow users to manage notification settings.'
      );
      writeOpenItems(withItem);
      await wait(2500);

      // Delete the added item
      writeOpenItems(content);
      await wait(1500);
    });
  });

  // ── Scenario 5: Sort & Filter ───────────────────────────────────────────

  test('sort-filter', async function () {
    if (!shouldRecord('sort-filter')) { return this.skip(); }
    console.log('  🎬 Recording: sort-filter');
    await openPanel();

    await recordScenario('sort-filter', GIF_WIDTH_EDITOR, async () => {
      // Sort by status (dropdown opens visually for 800ms then selects)
      await demoMessage({ command: 'demo:sort', value: 'status' });
      await wait(3000);

      // Back to manual
      await demoMessage({ command: 'demo:sort', value: 'manual' });
      await wait(2500);

      // Filter: Open only
      await demoMessage({ command: 'demo:filter', value: 'open' });
      await wait(2000);

      // Filter: Done only
      await demoMessage({ command: 'demo:filter', value: 'done' });
      await wait(2000);

      // Back to All
      await demoMessage({ command: 'demo:filter', value: 'all' });
      await wait(1000);

      // Search with typing effect
      await demoMessage({ command: 'demo:search', value: 'auth' });
      await wait(2000);

      // Clear search
      await demoMessage({ command: 'demo:search', value: '' });
      await wait(1000);
    });
  });

  // ── Scenario 6: Font Size ───────────────────────────────────────────────

  test('font-size', async function () {
    if (!shouldRecord('font-size')) { return this.skip(); }
    console.log('  🎬 Recording: font-size');
    await openPanel();

    await recordScenario('font-size', GIF_WIDTH_EDITOR, async () => {
      for (let i = 0; i < 4; i++) {
        await demoMessage({ command: 'demo:fontSize', value: 'increase' });
        await wait(500);
      }
      await wait(1000);

      for (let i = 0; i < 6; i++) {
        await demoMessage({ command: 'demo:fontSize', value: 'decrease' });
        await wait(500);
      }
      await wait(1000);

      await demoMessage({ command: 'demo:fontSize', value: 'reset' });
      await wait(1000);
    });
  });

  // ── Scenario 7: Drag & Drop (Reorder) ──────────────────────────────────

  test('drag-drop', async function () {
    if (!shouldRecord('drag-drop')) { return this.skip(); }
    console.log('  🎬 Recording: drag-drop');
    await openPanel();

    await recordScenario('drag-drop', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Swap "Dark mode preference sync" and "Profile avatar upload"
      const lines = content.split('\n');
      const darkIdx = lines.findIndex(l => l.includes('**Dark mode preference sync**'));
      const avatarIdx = lines.findIndex(l => l.includes('**Profile avatar upload**'));
      if (darkIdx >= 0 && avatarIdx >= 0) {
        const temp = lines[darkIdx];
        lines[darkIdx] = lines[avatarIdx];
        lines[avatarIdx] = temp;
        writeOpenItems(lines.join('\n'));
        await wait(2500);
      }

      // Revert
      writeOpenItems(content);
      await wait(1500);
    });
  });

  // ── Scenario 8: Git Diff ───────────────────────────────────────────────

  test('git-diff', async function () {
    if (!shouldRecord('git-diff')) { return this.skip(); }
    console.log('  🎬 Recording: git-diff');
    await openPanel();

    await recordScenario('git-diff', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      let modified = content;

      // Modify an item text
      modified = modified.replace(
        '- [ ] **Dark mode preference sync** — not implemented.',
        '- [ ] **Dark mode & theme preference sync** — backend ready, frontend pending.'
      );

      // Add a new item
      modified = modified.replace(
        '- [ ] **Profile avatar upload** — not implemented.',
        '- [ ] **Profile avatar upload** — not implemented.\n- [ ] **Session timeout settings** — allow users to configure session length.'
      );

      writeOpenItems(modified);
      await wait(3000);

      // Revert
      writeOpenItems(content);
      await wait(1500);
    });
  });

  // ── Scenario 9: Undo / Redo ────────────────────────────────────────────

  test('undo-redo', async function () {
    if (!shouldRecord('undo-redo')) { return this.skip(); }
    console.log('  🎬 Recording: undo-redo');
    await openPanel();

    await recordScenario('undo-redo', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Make a visible change (User Management item)
      const change1 = content.replace(
        '- [ ] **Profile avatar upload** — not implemented.',
        '- [x] ~~**Profile avatar upload**~~ — done (2025-12-15).'
      );
      writeOpenItems(change1);
      await wait(1500);

      // Undo via button
      await demoMessage({ command: 'demo:click', selector: '#undoBtn' });
      await wait(2000);

      // Redo via button
      await demoMessage({ command: 'demo:click', selector: '#redoBtn' });
      await wait(2000);

      // Revert
      writeOpenItems(content);
      await wait(1000);
    });
  });

  // ── Scenario 10: Panel Views ───────────────────────────────────────────

  test('panel-views', async function () {
    if (!shouldRecord('panel-views')) { return this.skip(); }
    console.log('  🎬 Recording: panel-views');

    // Start with the raw markdown visible
    const uri = vscode.Uri.file(OPEN_ITEMS_PATH);
    await vscode.commands.executeCommand('vscode.open', uri);
    await wait(1500);

    await recordScenario('panel-views', GIF_WIDTH_EDITOR, async () => {
      await wait(1500);

      // Open with custom editor
      await vscode.commands.executeCommand('vscode.openWith', uri, 'openItemsTracker.markdownEditor');
      await wait(3000);
    });
  });

  // ── Scenario 11: Inline Edit ───────────────────────────────────────────

  test('inline-edit', async function () {
    if (!shouldRecord('inline-edit')) { return this.skip(); }
    console.log('  🎬 Recording: inline-edit');
    await openPanel();

    await recordScenario('inline-edit', GIF_WIDTH_EDITOR, async () => {
      const content = readOpenItems();

      // Click on "Dark mode preference sync" item text → textarea appears → type → save
      await demoMessage({
        command: 'demo:inlineEdit',
        selector: '.item-text-content',
        itemIndex: 2,  // 3rd item (0=email verification, 1=OAuth2, 2=dark mode)
        newText: 'Dark mode & theme preference sync',
        delay: 50,
      });
      // Wait for typing animation + save
      await wait(3500);

      // Edit an item note (OAuth2 login) — shows diff highlight on the note
      await demoMessage({
        command: 'demo:inlineEdit',
        selector: '.item-note',
        itemIndex: 1,  // 2nd note (0=email verification, 1=OAuth2)
        newText: 'Google done, GitHub and Apple in progress.',
        delay: 40,
      });
      await wait(4000);

      // Revert file to original (clears the edits)
      writeOpenItems(content);
      await wait(1000);
    });
  });

  // ── Scenario 12: File Loading ──────────────────────────────────────────

  test('file-loading', async function () {
    if (!shouldRecord('file-loading')) { return this.skip(); }
    console.log('  🎬 Recording: file-loading');

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await wait(1000);

    await recordScenario('file-loading', GIF_WIDTH_EDITOR, async () => {
      const uri = vscode.Uri.file(OPEN_ITEMS_PATH);
      await vscode.commands.executeCommand('vscode.open', uri);
      await wait(2000);

      await vscode.commands.executeCommand('openItemsTracker.showPanel');
      await wait(3000);
    });
  });
});
