# Change Log

All notable changes to the "open-items-tracker" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2026-06-05

### Added

- **AI Skill auto-install**: on first activation the extension detects the running IDE and prompts to copy the bundled `SKILL.md` to the correct path for the AI coding assistant (Claude Code, Antigravity).
- **IDE detection**: distinguishes VS Code, Cursor, Windsurf, and Antigravity IDE via `vscode.env.appName`; Cursor and Windsurf share the Claude Code path (`~/.claude/skills/`), Antigravity uses `~/.gemini/config/skills/`.
- **Cross-platform path handling**: `os.homedir()` + `path.join()` produce correct paths on Windows, macOS, and Linux for all supported IDEs.
- **AI Skill Status & Install command** (`openItemsTracker.skillStatus`): QuickPick dialog showing install status, path, and actions — Install, Reinstall, Open Folder, Re-enable prompt. Accessible from the Command Palette, the sidebar toolbar icon, and the 🧩 button in the panel header and empty-state screen.
- **Warning for unverified Antigravity path**: shown in both the startup prompt and the QuickPick when using the default path without a user override; clicking the warning item opens the relevant setting directly.
- New settings: `openItemsTracker.promptSkillInstall`, `openItemsTracker.skillPathClaudeCode`, `openItemsTracker.skillPathAntigravity`.

### Changed

- Skill install prompt now fires 2 seconds after activation to avoid colliding with other IDE startup notifications.
- Startup prompt uses file-existence check instead of a globalState flag as the primary gate; the flag (`skillDontAsk`) is set only when the user explicitly chooses "Don't Ask Again".
- "Open Folder" in the skill status dialog uses `vscode.env.openExternal` (cross-platform) instead of `revealFileInOS` (file-only, Windows-biased).

## [0.0.8] - 2026-06-04

### Fixed

- Item drag-and-drop reorder broken after handle-based dragging refactor: the `dragover` handler was filtering drop targets with `[draggable="true"]`, but only the source item had that attribute, so the browser blocked every drop.

## [0.0.7] - 2026-06-04

### Changed

- Inline text editing is now triggered by a single click.
- Double-clicking inside an active text input editor now allows selecting individual words instead of resetting the edit.
- Drag-and-drop handles for modules, sub-sections, and items are now larger, easier to target, and styled with subtle idle opacity rising on hover.

## [0.0.6] - 2026-06-04

### Added

- Git status visualization with visual gutter borders and background opacity highlights.
- Word-level inline diffing (red/green insertions/deletions) for modified tasks and descriptive notes.
- Undo/redo capabilities via keyboard shortcuts (`Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`) and stack history.
- Dropdown select badges for interactive status transitions (Open, Partial, Future, Done) with emoji synchronization.
- Hybrid fuzzy item matching using Jaccard word-level similarity and Levenshtein distance to correctly pair reordered and edited tasks.
- Precise diffing for descriptive notes, including word highlights and note deletion rendering.

## [0.0.5] - 2026-06-02

### Changed

- Added Antigravity IDE as explicitly supported editor in README and package description

## [0.0.4] - 2026-06-02

### Changed

- Updated README with full feature documentation and settings reference
- Updated package description and keywords

## [0.0.3] - 2026-06-02

### Added

- Full CRUD for modules, sub-sections, and items: inline `+ Add` buttons and hover `×` delete buttons
- Drag-to-reorder modules and sub-sections via dedicated `⋮` handles
- Inline double-click editing for item text, item notes, module/sub-section headers, and module context description
- Sort strategies: as-in-file, by status, alphabetical, done-last, done-first (persisted across re-renders)
- VS Code settings: `defaultSort`, `collapseByDefault`, `showDoneItems`, `showFutureItems`
- File picker, active-editor shortcut, and OS drag-and-drop for loading `open-items.md`
- Clear button to reset the tracked file
- Light/dark icon variants for the panel tab

### Fixed

- Empty modules hidden by filter (`Array.some` on empty array returned `false`)
- Accordion collapse broken by CSP blocking inline `onclick` handlers; replaced with event delegation
- Panel tab icon appearing black on dark themes

## [0.0.2] - 2026-06-02

### Changed

- Reorganized AI agent skill folder to adhere to the standard structure (`skills/open-items-tracker/SKILL.md`)
- Clarified instructions in README on how to use the skill to generate the backlog

## [0.0.1] - 2026-06-02

### Added

- Initial release of Open Items Tracker
- Two-way checkbox synchronization with `open-items.md`
- Sidebar and Panel views
- Progress bars and status filters
