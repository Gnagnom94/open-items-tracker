export class UndoRedoManager {
  private static instance: UndoRedoManager;
  private undoStacks = new Map<string, string[]>();
  private redoStacks = new Map<string, string[]>();
  private maxStackSize = 50;
  public isInternalWrite = false;

  private constructor() {}

  public static getInstance(): UndoRedoManager {
    if (!UndoRedoManager.instance) {
      UndoRedoManager.instance = new UndoRedoManager();
    }
    return UndoRedoManager.instance;
  }

  public setMaxStackSize(size: number) {
    this.maxStackSize = size;
  }

  public pushState(filePath: string, content: string) {
    if (!this.undoStacks.has(filePath)) {
      this.undoStacks.set(filePath, []);
    }
    const stack = this.undoStacks.get(filePath)!;
    stack.push(content);
    if (stack.length > this.maxStackSize) {
      stack.shift();
    }
    // Clear redo stack on new action
    this.redoStacks.delete(filePath);
  }

  public undo(filePath: string, currentContent: string): string | undefined {
    const undoStack = this.undoStacks.get(filePath);
    if (!undoStack || undoStack.length === 0) { return undefined; }

    const previousContent = undoStack.pop()!;
    if (!this.redoStacks.has(filePath)) {
      this.redoStacks.set(filePath, []);
    }
    this.redoStacks.get(filePath)!.push(currentContent);

    return previousContent;
  }

  public redo(filePath: string, currentContent: string): string | undefined {
    const redoStack = this.redoStacks.get(filePath);
    if (!redoStack || redoStack.length === 0) { return undefined; }

    const nextContent = redoStack.pop()!;
    if (!this.undoStacks.has(filePath)) {
      this.undoStacks.set(filePath, []);
    }
    this.undoStacks.get(filePath)!.push(currentContent);

    return nextContent;
  }

  public hasUndo(filePath: string): boolean {
    const stack = this.undoStacks.get(filePath);
    return !!stack && stack.length > 0;
  }

  public hasRedo(filePath: string): boolean {
    const stack = this.redoStacks.get(filePath);
    return !!stack && stack.length > 0;
  }

  public clearRedo(filePath: string) {
    this.redoStacks.delete(filePath);
  }

  public clearAll(filePath: string) {
    this.undoStacks.delete(filePath);
    this.redoStacks.delete(filePath);
  }
}

export const undoRedoManager = UndoRedoManager.getInstance();
