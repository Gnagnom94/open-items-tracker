# Change Log

All notable changes to the "open-items-tracker" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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