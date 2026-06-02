# Change Log

All notable changes to the "open-items-tracker" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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