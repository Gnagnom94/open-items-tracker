# Change Log

All notable changes to the "open-items-tracker" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.4.0] - 2026-06-07

### Added

- **100% test coverage**: 314 unit and integration tests across 12+ suites covering parser, transforms, editors, store, undo/redo, git integration, settings, skill installer, webview host, and extension activation.
- **CI pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`) runs tests with coverage on every push to `main` and on pull requests; auto-updates a dynamic coverage badge in the README via Gist endpoint.
- **Coverage badge**: dynamic shields.io badge in the README reflecting real-time statement coverage from CI.
- **Modified file test**: `getGitState` test for tracked files with local modifications, exercising the `modified` status path.

### Changed

- **`gitManager.ts` simplified**: removed dead `??` status branch (tracked files can never be untracked) and collapsed the status assignment to a single ternary. Removed the always-true `status !== 'untracked'` guard. Type narrowed from `'clean' | 'modified' | 'untracked'` to `'clean' | 'modified'`.
- **`undoRedoManager.ts` simplified**: removed dead defensive guard `if (!undoStacks.has())` in `redo()` — the undo stack always exists when redo entries exist.
- **`gitDiff.ts` simplified**: removed `try/catch` wrapper around `parseDocument` — the parser is a pure function that never throws.
- **`fileTransforms.ts` simplified**: removed dead `while` loops in `deleteModule` and `deleteSubSection` — `nextModuleIdx`/`nextSectionIdx` already include trailing blank lines in the splice range.

## [0.3.0] - 2026-06-07

### Added

- **Custom Editor integration**: the extension now registers as a custom editor for `.md` files, allowing the Open Items panel to open directly as an editor tab via "Reopen With…" or the action bar button.
- **Content-based action bar button**: a "Show Panel" button appears in the editor title bar only when the active markdown file contains open-items syntax (`## ` headers + `[ ]`/`[x]` checkboxes).
- **Font size controls**: three new buttons (A−, A, A+) in the toolbar to decrease, reset, and increase the panel font size. The setting persists across sessions.
- **Separate font size settings**: sidebar and custom editor have independent font size settings (`fontSizeSidebar` default 12px, `fontSizeEditor` default 13px).
- **Responsive sidebar layout**: comprehensive CSS rules for narrow widths — stats grid wraps into rows, header stacks vertically, filters/controls compact, items and modules reduce padding.

### Changed

- **Tab replacement UX**: clicking "Show Panel" on an active markdown file now replaces the text editor tab in-place using `tabGroups.close()` + `vscode.openWith` + `moveActiveEditor`, preserving tab position.
- **"Use Active Editor" with custom editor support**: the sidebar button now detects files open in custom editors via the `TabGroups` API (fallback when `activeTextEditor` is undefined).
- **Updated button icons**: Use Active Editor → `↙`, Choose File → `…`, Clear → `🗑`, Open File → `Raw ↗`.
- **Stats cards layout**: switched from flexbox to CSS Grid (`auto-fit`) for natural wrapping at any width without clipping.
- **Button overflow fix**: `white-space: nowrap` on secondary buttons prevents icon line-break; `flex-wrap` on header actions prevents clipping in narrow sidebars.

### Fixed

- **Extension activation**: added `onLanguage:markdown` activation event so the context key and action bar button are available immediately when opening any markdown file.
- **Custom editor toolbar**: file-selection buttons (Use Active, Choose File, Clear) and drop overlay are hidden when the panel is bound to a fixed file (custom editor mode).

## [0.2.1] - 2026-06-07

### Changed

- **Renderer split**: monolithic `renderer.ts` (1637 lines) decomposed into five focused modules under `src/webview/` — `gitDiff.ts`, `htmlTemplates.ts`, `webviewMain.ts`, `webviewStyles.ts`, and a barrel `index.ts`.
- **Webview TypeScript entrypoint**: webview client JavaScript (previously an inline template literal) is now a typed TypeScript file bundled by esbuild with `platform: 'browser'` → `dist/webview.js`.
- **External CSS**: webview styles extracted from an inline string to a standalone `media/webview.css` file loaded via `<link>`.
- **Panel/Sidebar deduplication**: shared logic (~120 lines duplicated between `panel.ts` and `sidebarProvider.ts`) extracted into an abstract `WebviewHost` base class; `panel.ts` reduced by 79%, `sidebarProvider.ts` by 80%.
- **Shared types**: common TypeScript interfaces moved to `src/shared/types.ts`, imported by both the extension host (Node) and webview client (browser).
- **Dual esbuild build**: `esbuild.js` now builds two entrypoints in parallel — extension (Node/CJS) and webview (browser/IIFE).

## [0.2.0] - 2026-06-07

### Added

- **Clickable markdown links**: `[text](path)` links in item text and notes are now rendered as clickable, themed links that open the target file in the editor.
- **Line-range navigation**: links with `#L10-L20` fragments open the file and jump to the specified line range with selection.
- **Legacy `file:///` URI support**: absolute `file:///` URIs from older backlog files are handled as clickable links alongside relative paths.
- **Hover tooltips on links**: hovering a link shows the full target path and line range.
- **Resizable textarea for inline editing**: inline edit now uses a `<textarea>` with soft-wrapping, auto-sizing (`field-sizing: content`), and vertical drag-to-resize.
- **Skill update detection**: the installer now compares installed vs. bundled skill content on startup; if they differ, it prompts to update. The status dialog shows ⚠️ "Update available" when the skill is outdated.
- **Recursive skill install**: the installer now copies the entire skill folder (including `references/`, `scripts/`, etc.) instead of just `SKILL.md`, making it future-proof for richer skill structures.

### Changed

- **Inline editing preserves link syntax**: editing a note or item text now shows raw markdown `[text](path)` syntax in the input; saving/canceling restores rendered clickable links.
- **Skill updated for relative paths**: the bundled `SKILL.md` now instructs the AI agent to use relative paths from the project root (e.g., `[guest.py](backend/models/guest.py#L5-L24)`) instead of absolute `file:///` URIs.

### Fixed

- **Missing file warning**: clicking a link whose target file no longer exists shows a VS Code warning notification instead of failing silently.

## [0.1.1] - 2026-06-07

### Changed

- **Sticky topbar**: header, stats dashboard, progress bar, Git status panel, and search/filter controls now stay pinned at the top while scrolling, with a frosted-glass blur effect and subtle drop shadow when scrolled.
- **Premium stats cards**: stat counters restyled as individual dashboard cards with accent-colored top borders, tinted backgrounds, and hover lift animations.
- **Progress bar**: upgraded with a gradient fill and a soft glow shadow matching the completion color.
- **Module cards**: added hover border highlight and elevated shadow on mouse-over for a more tactile feel.
- **Item rows**: added subtle background highlight on hover.
- **Buttons & controls**: unified icon buttons to consistent 28×28 boxes with smooth hover translations; search input and sort dropdown now show a focus ring glow; filter pills gain a slight lift on hover and a drop shadow when active.
- **Status badges**: added scale and brightness micro-animation on hover.
- **Add buttons**: rounded corners, background tint on hover, and slight lift animation.

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
