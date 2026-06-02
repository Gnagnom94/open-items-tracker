import * as vscode from 'vscode';

type Listener = (filePath: string | undefined) => void;

let _ctx: vscode.ExtensionContext;
const _listeners: Listener[] = [];

export function initStore(ctx: vscode.ExtensionContext): void {
  _ctx = ctx;
}

export function getStoredPath(): string | undefined {
  return _ctx.workspaceState.get<string>('oit.filePath');
}

export function setStoredPath(p: string | undefined): void {
  _ctx.workspaceState.update('oit.filePath', p);
  _listeners.forEach(fn => fn(p));
}

export function onPathChange(fn: Listener): vscode.Disposable {
  _listeners.push(fn);
  return {
    dispose: () => {
      const i = _listeners.indexOf(fn);
      if (i >= 0) { _listeners.splice(i, 1); }
    },
  };
}
