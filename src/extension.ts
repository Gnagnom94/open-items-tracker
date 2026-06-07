import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SidebarProvider } from './sidebarProvider';
import { OpenItemsEditorProvider } from './customEditorProvider';
import { initStore } from './store';
import { getStoredPath, setStoredPath } from './store';
import { promptSkillInstall, showSkillStatus } from './skillInstaller';

export function activate(context: vscode.ExtensionContext) {
  initStore(context);
  promptSkillInstall(context);

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
  );

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      OpenItemsEditorProvider.viewType,
      new OpenItemsEditorProvider(context.extensionUri),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('openItemsTracker.skillStatus', () => showSkillStatus(context))
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('openItemsTracker.showPanel', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      const fileUri = resolveFileUri();
      /* c8 ignore start -- dialog interaction: showOpenDialog blocks in tests */
      if (!fileUri) {
        const result = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { Markdown: ['md'] },
          title: 'Select open-items.md',
        });
        if (result?.[0]) {
          setStoredPath(result[0].fsPath);
          await vscode.commands.executeCommand('vscode.openWith', result[0], OpenItemsEditorProvider.viewType);
        }
        return;
      }
      /* c8 ignore stop */

      // Replace the current text editor tab with the custom editor in-place.
      // VS Code has no native "reopen in-place" primitive, so we:
      //   1. Remember the tab position
      //   2. Close the specific tab via tabGroups.close()
      //   3. Open with the custom editor
      //   4. Move the new tab to the original position
      const activeGroup = vscode.window.tabGroups.activeTabGroup;
      const activeTab = activeGroup.activeTab;
      const isTargetTab = activeEditor
        && activeEditor.document.uri.toString() === fileUri.toString()
        && activeTab;

      if (isTargetTab) {
        const tabIndex = activeGroup.tabs.indexOf(activeTab);
        await vscode.window.tabGroups.close(activeTab);
        await vscode.commands.executeCommand('vscode.openWith', fileUri, OpenItemsEditorProvider.viewType);
        if (tabIndex >= 0) {
          await vscode.commands.executeCommand('moveActiveEditor', { to: 'position', value: tabIndex + 1 });
        }
      /* c8 ignore next 3 -- requires non-target .md tab to be active */
      } else {
        await vscode.commands.executeCommand('vscode.openWith', fileUri, OpenItemsEditorProvider.viewType);
      }
    })
  );

  // ── Context key: detect open-items-compatible markdown files ──────────────
  updateOpenItemsContext(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => updateOpenItemsContext(editor))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      const active = vscode.window.activeTextEditor;
      if (active && e.document === active.document) {
        updateOpenItemsContext(active);
      }
    })
  );
}

// ── Open-items file detection ────────────────────────────────────────────────

/** Minimum pattern: at least one `## ` module header AND at least one `- [ ]` or `- [x]` checkbox. */
function isOpenItemsSyntax(content: string): boolean {
  const hasModule = /^## .+/m.test(content);
  const hasCheckbox = /^- \[(x| )\] /m.test(content);
  return hasModule && hasCheckbox;
}

function updateOpenItemsContext(editor: vscode.TextEditor | undefined): void {
  let isMatch = false;
  if (editor && editor.document.languageId === 'markdown') {
    isMatch = isOpenItemsSyntax(editor.document.getText());
  }
  vscode.commands.executeCommand('setContext', 'openItemsTracker.isOpenItemsFile', isMatch);
}

// ── File resolution ──────────────────────────────────────────────────────────

/** Resolve the target file URI from the active editor, stored path, or workspace. */
function resolveFileUri(): vscode.Uri | undefined {
  // 1. Active text editor with a .md file
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.fileName.endsWith('.md')) {
    return activeEditor.document.uri;
  }

  // 2. Stored path from previous session
  /* c8 ignore start -- separate module instance / requires docs/open-items.md */
  const stored = getStoredPath();
  if (stored && fs.existsSync(stored)) {
    return vscode.Uri.file(stored);
  }

  // 3. Workspace default: docs/open-items.md
  for (const folder of vscode.workspace.workspaceFolders || []) {
    const p = path.join(folder.uri.fsPath, 'docs', 'open-items.md');
    if (fs.existsSync(p)) { return vscode.Uri.file(p); }
  }
  /* c8 ignore stop */

  return undefined;
}

export function deactivate() {}

