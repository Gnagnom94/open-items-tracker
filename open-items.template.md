# Open Items

Consolidated backlog of pending work items, reconciled against formal requirements and project documentation.
Last updated: YYYY-MM-DD

<!-- ℹ️  HOW TO USE THIS TEMPLATE
     1. Rename this file to `open-items.md` (or place it at `docs/open-items.md`).
     2. Replace the placeholder text below with your project's modules, sub-sections, and items.
     3. Delete these HTML comments when you're done — the extension ignores them, but your file stays cleaner.
     4. See `open-items.example.md` for a fully populated example.
-->

---

<!-- MODULE — Use a `## ` heading with an emoji prefix.
     Recommended emoji per area:
       📋 General requirements    🎨 UI / Frontend       🧩 Core / API
       🔀 Routing / Workflows     🔐 Security            👥 User management
       🧪 Testing                 📊 Dashboard / Reports  🤖 AI / ML
       ⚙️  Infrastructure / DevOps  🔮 Future phase
-->

## 📋 Module Name

<!-- MODULE CONTEXT — One or two lines describing this module's purpose. Parsed as the module description. -->
Brief context about this module's purpose and scope.

### Sub-section Title

<!-- DONE ITEM — Checked checkbox, strikethrough bold text, date in parentheses, optional note with file links. -->
- [x] ~~**Completed item description**~~ — done (YYYY-MM-DD). Implemented in [filename.ext](path/to/file.ext#L1-L20).

<!-- OPEN ITEM — Unchecked checkbox, bold text, optional note after em-dash. -->
- [ ] **Open item description** — context on what's needed and why.

<!-- PARTIAL ITEM — Unchecked checkbox, bold text, 🔄 emoji. Note explains what's done vs. what remains. -->
- [ ] **Partial item description** 🔄 — what's done so far and what remains. See [filename.ext](path/to/file.ext).

<!-- FUTURE ITEM — Unchecked checkbox, bold text, 🔮 emoji. Scoped for a later release. -->
- [ ] **Future item description** 🔮 — planned for a later phase.

---

## 🧩 Another Module

Description of this module.

<!-- Items without a sub-section are attached directly to the module. -->
- [x] ~~**A completed task**~~ — done (YYYY-MM-DD). See [file.ext](path/to/file.ext).
- [ ] **An open task** — what needs to happen.

### Optional Sub-section

- [ ] **Task inside a sub-section** — details here.

---

<!-- FUTURE PHASE MODULE — Group items explicitly planned for a later release.
     These are not counted as "missing" for the current version. -->

## 🔮 Future Phase (vX.Y)

Items explicitly planned for a future release. Not counted as missing for the current version.

- [ ] **Future feature A** 🔮 — brief description of the planned capability.
- [ ] **Future feature B** 🔮 — brief description.

---

<!-- FOOTER — Optional. Helps track how the backlog was generated. -->
*Backlog created YYYY-MM-DD by reconciling `docs/requirements.md` and the current codebase state.*
