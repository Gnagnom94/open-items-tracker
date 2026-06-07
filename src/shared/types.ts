// ── Shared type definitions ──────────────────────────────────────────────────
// Imported by both the extension host (Node) and the webview client (browser).
// Only pure type declarations — no runtime code, no VS Code or Node imports.

// ── Parser types ─────────────────────────────────────────────────────────────

export type ItemStatus = 'done' | 'open' | 'partial' | 'future';

export interface OpenItem {
  text: string;
  status: ItemStatus;
  note?: string;
  date?: string;
  rawLine: string;
}

export interface SubSection {
  title: string;
  rawLine: string;
  items: OpenItem[];
}

export interface Module {
  title: string;
  rawLine: string;
  context: string;
  subSections: SubSection[];
  items: OpenItem[];
}

export interface ParsedDocument {
  lastUpdated?: string;
  filePath?: string;
  modules: Module[];
  stats: {
    total: number;
    done: number;
    open: number;
    partial: number;
    future: number;
  };
}

// ── Settings types ───────────────────────────────────────────────────────────

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

// ── Git diff types ───────────────────────────────────────────────────────────

export interface GitItemInfo {
  text: string;
  status: 'done' | 'open' | 'partial' | 'future';
  note?: string;
  date?: string;
}

export interface RenderGitState {
  isRepo: boolean;
  status: 'clean' | 'modified' | 'untracked' | 'error';
  stats: {
    added: number;
    modified: number;
    deleted: number;
  };
  itemStatus: Record<string, 'added' | 'modified' | 'clean'>;
  itemDiffHtml: Record<string, string>;
  itemNoteDiffHtml: Record<string, string>;
  deletedItems: Record<string, GitItemInfo[]>;
}

// ── History state ────────────────────────────────────────────────────────────

export interface HistoryState {
  hasUndo: boolean;
  hasRedo: boolean;
}
