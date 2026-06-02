import * as vscode from 'vscode';

export type SortStrategy = 'manual' | 'status' | 'alpha' | 'done-last' | 'done-first';

export interface ExtensionSettings {
  defaultSort: SortStrategy;
  collapseByDefault: boolean;
  showDoneItems: boolean;
  showFutureItems: boolean;
}

export function readSettings(): ExtensionSettings {
  const c = vscode.workspace.getConfiguration('openItemsTracker');
  return {
    defaultSort: c.get<SortStrategy>('defaultSort', 'manual'),
    collapseByDefault: c.get<boolean>('collapseByDefault', false),
    showDoneItems: c.get<boolean>('showDoneItems', true),
    showFutureItems: c.get<boolean>('showFutureItems', true),
  };
}
