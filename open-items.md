# Open Items

Consolidated backlog of pending development items, reconciled against the **Functional Requirements** specification,
the **Implementation Plan**, and the current **codebase state**.

**Last updated:** 2026-06-01 (post-Milestone 3)  
**Requirements coverage:** ~55% (11/20 FR partially or fully implemented)

---

## 🧩 Module A — Core API

Foundation layer: REST endpoints, authentication, and request/response contracts.

### Authentication & Authorization ✅ / 🔄

- [x] ~~**FR-API-001 — JWT-based authentication**~~ — done (2026-05-10). `POST /auth/token/` returns access + refresh tokens.
- [x] ~~**FR-API-002 — Token refresh endpoint**~~ — done (2026-05-10). `POST /auth/token/refresh/` with sliding expiry.
- [ ] **FR-API-003 — Role-based access control (admin / editor / viewer)** 🔄 — `User` model exists but has no role field. Add `role` enum and per-endpoint permission checks.
- [ ] **FR-API-004 — API key support for machine-to-machine calls** — not implemented. Requires `rest_framework_api_key` or equivalent. Lower priority than RBAC.

### Data Endpoints

- [x] ~~**FR-API-005 — `GET /items/` list with pagination**~~ — done (2026-05-15). Cursor-based pagination, 50 items/page.
- [x] ~~**FR-API-006 — `POST /items/` create**~~ — done (2026-05-15). Validates required fields, returns 201 with `Location` header.
- [ ] **FR-API-007 — `PATCH /items/{id}/` partial update** — stub exists but only `status` field is writable. Extend to cover all editable fields.
- [ ] **FR-API-008 — Bulk status update `POST /items/bulk-update/`** — not implemented. Needed for batch automation workflows.
- [ ] **FR-API-009 — OpenAPI 3.0 schema auto-generation** — not configured. Add `drf-spectacular` and expose `/schema/swagger-ui/`.

---

## 🎨 Module B — Frontend Dashboard

Vue 3 SPA consuming the Core API. Displays items, allows inline editing, and shows progress analytics.

### Item List & Editing 🔄

- [x] ~~**[M1] Item list view**~~ — done (2026-05-20). `ItemList.vue` renders paginated cards. Handles loading/empty/error states.
- [x] ~~**[M1] Status badge component**~~ — done (2026-05-20). Color-coded pill: Open (blue), In Progress (amber), Done (green), Future (grey).
- [x] ~~**[M2] Inline checkbox toggle**~~ — done (2026-05-28). Optimistic UI update; reverts on API error.
- [ ] **[M2] Full edit form (modal)** 🔄 — `EditModal.vue` exists but title/description fields are read-only. Wire up `PATCH /items/{id}/`.
- [ ] **[M3] Search & filter bar** — not implemented. Needs free-text search + status filter chips + clear button.
- [ ] **[M3] Sort controls** — not implemented. Sort by: manual order, status, alphabetical, due date.

### Analytics & Progress

- [x] ~~**[M3] Global progress bar**~~ — done (2026-06-01). Calculated from `done / total` across all items. Shown in the header.
- [ ] **[M3] Per-module mini progress bar** — not implemented. Requires grouping items by `module` field in the API response.
- [ ] **[M4] KPI summary cards** — not implemented. Cards for: total items, open, in-progress, blocked, done this week.

---

## ⚙️ Module C — Background Workers

Async processing for notifications, scheduled exports, and cleanup tasks.

- [ ] **FR-WRK-001 — Email notifications on item assignment** — not implemented. Requires task queue (Celery or equivalent) and email backend configuration.
- [ ] **FR-WRK-002 — Daily digest report** — not implemented. Scheduled task (cron) that emails a summary of open/overdue items to team leads.
- [ ] **FR-WRK-003 — Auto-archive done items older than 90 days** — not implemented. Periodic cleanup task. Needs a soft-delete `archived_at` field on the model.
- [x] ~~**FR-WRK-004 — Async CSV export**~~ — done (2026-05-30). `POST /exports/` creates a background job; `GET /exports/{id}/` polls status; download link in response when ready.

---

## 🔐 Security

- [x] ~~**HTTPS enforced in production**~~ — done. Configured at the reverse-proxy level (Nginx). `SECURE_SSL_REDIRECT=True` in Django settings.
- [x] ~~**CSRF protection**~~ — done. `CsrfViewMiddleware` active; SPA sends `X-CSRFToken` header on mutations.
- [ ] **Two-factor authentication (TOTP)** — not implemented. Required for admin accounts. Evaluate `django-otp` or SSO integration.
- [ ] **Audit log — who changed what and when** — not implemented. `django-simple-history` or a custom `AuditEvent` model with `actor`, `action`, `timestamp`, `diff`.
- [ ] **Content Security Policy (CSP) header** — not configured. Add strict CSP to prevent XSS. Use `django-csp`.

---

## 🚀 Infrastructure & DevOps

- [x] ~~**Docker multi-stage build**~~ — done. `Dockerfile` with `builder` → `runtime` stages. Final image < 200 MB.
- [x] ~~**docker-compose for local development**~~ — done. Services: `api`, `db` (PostgreSQL), `redis`, `worker`.
- [ ] **Kubernetes manifests (production)** — not present. Need Deployment, Service, Ingress (TLS), ConfigMap, Secret, HorizontalPodAutoscaler.
- [ ] **CI/CD pipeline** — not configured. Define GitHub Actions workflow: lint → test → build image → push to registry → deploy to staging.
- [ ] **Automated database backups** — not configured. Daily pg_dump to object storage (S3-compatible) with 30-day retention.
- [ ] **Uptime monitoring & alerting** — not configured. Integrate with an uptime service; alert on `/healthz` failures.

---

## 🧪 Testing

- [x] ~~**Unit tests — Core API models**~~ — done (2026-05-15). 22/22 PASSED. Covers `Item` model validation, status transitions, and `__str__` representations.
- [x] ~~**Integration tests — Auth endpoints**~~ — done (2026-05-20). 14/14 PASSED. Token obtain, refresh, expiry, and invalid credentials.
- [x] ~~**Integration tests — Item CRUD**~~ — done (2026-05-28). 31/31 PASSED. List, create, partial update, permission checks per role.
- [ ] **E2E tests (Playwright)** — not configured. Critical paths to cover: login, create item, toggle status, export CSV.
- [ ] **Test coverage gate ≥ 80%** — current coverage ~62%. Gaps in the background worker tasks and the bulk-update endpoint.
- [ ] **Performance/load tests** — not configured. Target: `GET /items/` must respond < 300 ms at 200 concurrent users.

---

## 🔮 Future Phase (v2.0 — Advanced Automation)

Items explicitly planned for a future release. Not counted as missing for v1.0.

- [ ] **Webhooks — outbound events on item status change** — `POST` to configurable URL on `created`, `updated`, `done`.
- [ ] **Public read-only shareable board** — generate a time-limited public link to a filtered board view (no auth required for the viewer).
- [ ] **Slack / Microsoft Teams integration** — post daily digest and assignment notifications to a configured channel.
- [ ] **Import from GitHub Issues / Linear / Jira** — one-time or scheduled sync of external tickets into the local board.
- [ ] **Mobile app (PWA)** — explicitly out of scope for v1.0; re-evaluate in v2.0 planning.

---

*Backlog updated 2026-06-01 (post-Milestone 3) by reconciling `docs/requirements.md`,
`docs/implementation-plan.md`, and the current codebase state.*
