import * as vscode from 'vscode';

export type SortStrategy = 'manual' | 'status' | 'alpha' | 'done-last' | 'done-first';

export interface ExtensionSettings {
  defaultSort: SortStrategy;
  collapseByDefault: boolean;
  showDoneItems: boolean;
  showFutureItems: boolean;
  gitIntegration: boolean;
  gitHighlight: boolean;
  gitShowInlineDiff: boolean;
  undoRedoStackSize: number;
}

export function readSettings(): ExtensionSettings {
  const c = vscode.workspace.getConfiguration('openItemsTracker');
  return {
    defaultSort: c.get<SortStrategy>('defaultSort', 'manual'),
    collapseByDefault: c.get<boolean>('collapseByDefault', false),
    showDoneItems: c.get<boolean>('showDoneItems', true),
    showFutureItems: c.get<boolean>('showFutureItems', true),
    gitIntegration: c.get<boolean>('gitIntegration', true),
    gitHighlight: c.get<boolean>('gitHighlight', true),
    gitShowInlineDiff: c.get<boolean>('gitShowInlineDiff', true),
    undoRedoStackSize: c.get<number>('undoRedoStackSize', 50),
  };
}
