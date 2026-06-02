import * as vscode from 'vscode';
import * as path from 'path';
import { OpenItemsPanel } from './panel';
import { SidebarProvider } from './sidebarProvider';
import { initStore, setStoredPath } from './store';

export function activate(context: vscode.ExtensionContext) {
  initStore(context);

  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('openItemsTracker.showPanel', () => {
      const activeEditor = vscode.window.activeTextEditor;
      let filePath: string | undefined;
      if (activeEditor && path.basename(activeEditor.document.fileName) === 'open-items.md') {
        filePath = activeEditor.document.fileName;
      }
      OpenItemsPanel.createOrShow(context.extensionUri, filePath);
    })
  );
}

export function deactivate() {}
