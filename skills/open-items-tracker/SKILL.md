---
name: open-items-tracker
description: Scan a project's formal documentation (requirements specs, functional analysis, technical analysis, proposals, system design), codebase state, diary entries, and current conversation context to generate or update a consolidated `docs/open-items.md` backlog. Use this skill whenever the user asks to track open items, generate a backlog, update the open items list, consolidate pending work, find what's left to do, check project completeness, audit requirements coverage, reconcile implemented vs. planned features, or says things like "aggiorna gli open items", "cosa manca da fare", "genera il backlog", "controlla cosa resta da implementare", "update the backlog", "what's left to build", "reconcile requirements". Also trigger when the user wants to understand the gap between formal specs and current implementation state, or after a significant development session to capture what was done and what remains.
---

# Open Items Tracker

Scan a project's formal documentation, codebase, diary entries, and conversation context to produce a consolidated backlog of pending work items in `docs/open-items.md`.

## Why This Matters

In projects with formal documentation (proposals, requirements specs, functional/technical analysis), there's always a gap between what was *planned* and what's *actually implemented*. This gap lives in people's heads, scattered across diary entries, conversation logs, and half-finished TODO comments. This skill turns that invisible gap into a clear, actionable checklist.

The backlog is not a wishlist — it's a reconciliation tool. It compares what the formal specs promise against what the codebase delivers, surfacing the delta as structured open items. When something is done, it gets crossed out with a date and reference. When something is pending, it stays visible with context on why it matters.

## When to Use

Invoke this skill when:
- Starting a new development session and need to know what's left
- After completing a significant feature, to update what's been done
- The user asks to reconcile specs vs. implementation
- The user asks "what's missing?" or "cosa resta da fare?"
- Periodically, to keep the backlog current

## Step 1: Discover Project Sources

Before generating anything, map out what documentation exists. Look for these sources in order of priority:

### Primary Sources (Formal Documentation)
Scan the project for formal documentation directories. Common locations:
- `docs/proposal/` — Project proposals, requirements specs
- `docs/` — System design, technical specs, functional analysis
- Root level — `README.md`, `PROJECT.md`

Look specifically for documents that define **what the system should do**:
- **Requisiti Funzionali** (Functional Requirements) — the authoritative source of required capabilities
- **Analisi Funzionale** (Functional Analysis) — detailed workflows and user stories
- **Analisi Tecnica** (Technical Analysis) — architecture decisions and technical requirements
- **Proposta Progettuale** (Project Proposal) — high-level scope and deliverables
- **System Design** — technical architecture and data model specs
- **Stima Tempistiche** — timeline with milestone deliverables

Read each document and extract every requirement, feature, or deliverable that implies implementation work.

### Secondary Sources (Living Documentation)
- `docs/diary/` — Decision diary entries (especially `## Open Items` sections)
- `docs/open-items.md` — Existing backlog (if updating rather than creating)
- Conversation history — current session's work and decisions

### Tertiary Sources (Codebase State)
- Backend models, views, serializers — what's actually implemented
- Frontend views, composables, routes — what UI exists
- Tests — what's covered
- Migrations — what data model changes have been applied

## Step 2: Extract Requirements from Formal Docs

Read each formal document and extract a structured list of requirements. For each requirement, capture:

- **Requirement ID** (if present, e.g., `RF-GW-001`, `RF-NLP-003`)
- **Module/Area** (e.g., "Modulo Gateway SI", "Modulo NLP Engine")
- **Description** — what the system must do
- **Priority** (if stated: Alta/Media/Bassa or High/Medium/Low)

Group requirements by module. This becomes the skeleton of the backlog.

## Step 3: Cross-Reference Against Codebase

For each requirement or feature identified in Step 2, check whether it's implemented:

1. **Search the codebase** for models, views, endpoints, components that correspond to the requirement
2. **Check tests** — if there are tests covering the feature, it's likely implemented
3. **Check migrations** — if there are data model changes, they've been applied
4. **Check frontend routes and views** — if there's a UI for it, it exists

Classify each item as:
- ✅ **Done** — implemented and verified (crossed out with date in the output)
- 🔄 **Partial** — partially implemented, needs completion
- ⬜ **Open** — not yet implemented
- 🔮 **Future Phase** — explicitly scoped for a later phase (mark but don't count as missing)

## Step 4: Collect Open Items from Diary Entries

If `docs/diary/` exists, scan all diary entries for `## Open Items` sections. Extract any items that:
- Are still unchecked (`- [ ]`)
- Haven't been superseded by later work
- Are still relevant to the current project state

Cross-reference these against the requirements list to avoid duplicates.

## Step 5: Capture Session Context

Review the current conversation for:
- Features just completed (should be marked as done)
- Issues discovered during development
- Decisions that created new follow-up items
- Technical debt deliberately introduced

## Step 6: Generate the Backlog

Write (or update) `docs/open-items.md` using this structure:

```markdown
# Open Items

Consolidated backlog of pending work items, reconciled against formal requirements and project documentation.
Last updated: YYYY-MM-DD

---

## 📋 Module/Area Name

Brief context about this module's purpose.

### Sub-section (if needed, e.g., "Phase A — Feature Name") Status-Emoji

- [x] ~~**Completed item description**~~ — done (YYYY-MM-DD). Brief note on what was done and where.
- [ ] **Open item description** — context on what's needed and why.
- [ ] **Another open item** — with reference to requirement ID if applicable (e.g., RF-GW-003).

(Repeat for each module/area)
```

### Formatting Rules

1. **Group by module or functional area**, matching the structure of the formal docs
2. **Completed items**: Use `- [x] ~~**strikethrough**~~` with a completion date and brief note
3. **Open items**: Use `- [ ] **bold**` with context on what's needed
4. **Partial items**: Use `- [ ] **bold** 🔄` with notes on what's done and what remains
5. **Future phase items**: Group separately under a `### Future Phase` sub-section
6. **Reference requirement IDs** when available (e.g., "See RF-NLP-005")
7. **Use emoji section headers** for visual scanning:
   - 🎫 for ticket/workflow items
   - 🔀 for routing/channel items
   - 🔐 for permissions/security
   - 👥 for user management
   - 🧪 for testing
   - 📊 for dashboard/reporting
   - 🤖 for AI/ML items
   - 📋 for general requirements
   - ⚙️ for infrastructure/DevOps

### Writing Style

- Write in the language of the formal documentation (if Italian, keep Italian; if English, keep English)
- Be specific: reference actual file paths, model names, endpoint URLs when marking items as done
- Keep open items actionable: "Implement X" not "X needs to be done someday"
- Include priority from the formal specs when available
- Cross-reference diary entries when an open item originated there

## Step 7: Confirm with the User

Before writing the file, show a summary:
1. **Total items**: how many requirements/features were identified
2. **Done**: how many are completed
3. **Open**: how many remain
4. **Coverage**: percentage of formal requirements that have been implemented
5. **Highlight**: top 3-5 most important open items

Ask the user to review and confirm before writing.

## Step 8: Suggest Next Steps

After writing the file:
1. Show the file path
2. Suggest committing: `git add docs/open-items.md && git commit -m "Docs: update open items backlog"`
3. If there's a decision diary skill configured, suggest logging the reconciliation as a diary entry

## Edge Cases

- **No formal documentation**: If there's no `docs/proposal/` or equivalent, build the backlog from the codebase structure, README, and conversation context. Note in the file header that this is a code-derived backlog, not a spec-reconciled one.
- **First-time creation**: When `docs/open-items.md` doesn't exist yet, create it from scratch. Be thorough — this is the foundational scan.
- **Update mode**: When `docs/open-items.md` already exists, read it first. Preserve the existing structure and items. Update statuses, add new items, mark completed ones. Don't remove items unless explicitly asked.
- **Multiple projects**: If the workspace contains multiple projects (e.g., monorepo), ask the user which project to scan, or scan the one that matches the current working directory.
- **Very large formal docs**: If the requirements documents are extremely long (500+ lines each), focus on the requirements matrix/traceability table if one exists — it's the most structured and scannable source.
