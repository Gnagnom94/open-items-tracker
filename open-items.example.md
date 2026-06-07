# Open Items

Consolidated backlog of pending work items, reconciled against formal requirements and project documentation.
Last updated: 2025-12-15

---

## 📋 User Management

Handles registration, authentication, profile management, and user preferences.

### Authentication ✅

- [x] ~~**Email/password registration with email verification**~~ — done (2025-10-05). Implemented in [views.py](backend/auth/views.py#L12-L45) and [serializers.py](backend/auth/serializers.py#L8-L30).
- [x] ~~**JWT-based login with access + refresh tokens**~~ — done (2025-10-08). Uses `djangorestframework-simplejwt`, configured in [settings.py](backend/config/settings.py#L87-L95).
- [x] ~~**Password reset via email link**~~ — done (2025-10-12). Template in [password_reset.html](backend/templates/email/password_reset.html); view in [views.py](backend/auth/views.py#L48-L72).

### Profile & Preferences 🔄

- [x] ~~**Basic profile page (name, avatar, bio)**~~ — done (2025-10-20). [ProfileView.vue](frontend/src/views/ProfileView.vue) with image upload via [useAvatar.ts](frontend/src/composables/useAvatar.ts).
- [ ] **Dark mode preference sync** 🔄 — frontend toggle works in [ThemeToggle.vue](frontend/src/components/ThemeToggle.vue) but the preference is not persisted to the API. Wire up `PATCH /users/me/preferences/`.
- [ ] **Notification preferences (email, in-app, push)** — not implemented. Needs a `NotificationPreference` model in [models.py](backend/users/models.py) and a settings UI component.

---

## 🎨 Dashboard & Analytics

Main landing page after login. Displays KPIs, activity feed, and quick actions.

### KPI Cards

- [x] ~~**Total active projects card**~~ — done (2025-11-01). Queries `GET /projects/?status=active` and renders count.
- [x] ~~**Tasks completed this week card**~~ — done (2025-11-01). Uses date-range filter on the tasks endpoint.
- [ ] **Revenue tracker card** — not implemented. Requires new `Invoice` model and aggregation endpoint.
- [ ] **Team velocity chart (burn-down)** — not implemented. Needs historical sprint data collection.

### Activity Feed

- [x] ~~**Real-time activity feed with WebSocket**~~ — done (2025-11-10). Consumer in [feed.py](backend/activity/consumers/feed.py); frontend hook in [useActivityFeed.ts](frontend/src/composables/useActivityFeed.ts).
- [ ] **Activity feed pagination (infinite scroll)** 🔄 — backend cursor pagination exists in [views.py](backend/activity/views.py#L15-L32), but the frontend loads only the first 20 items with no scroll trigger. See [ActivityFeed.vue](frontend/src/components/ActivityFeed.vue#L44).
- [ ] **Filter activity by type (comment, status change, assignment)** — not implemented. API supports `?type=` filter; needs frontend filter chips in [ActivityFeed.vue](frontend/src/components/ActivityFeed.vue).

---

## 🔀 Project Workflows

Configurable multi-stage workflows for project lifecycle management.

- [x] ~~**Default 3-stage workflow (To Do → In Progress → Done)**~~ — done (2025-11-15). Seeded via [0003_default_workflow.py](backend/workflows/migrations/0003_default_workflow.py).
- [ ] **Custom workflow builder** — not implemented. Users should define stages, transitions, and optional approval gates via a drag-and-drop UI.
- [ ] **Workflow templates (Kanban, Scrum, Waterfall)** — not implemented. Pre-configured templates that users can clone and customize.
- [ ] **Automated stage transitions based on rules** 🔄 — backend rule engine exists in [models.py](backend/workflows/models.py#L35-L68) (`WorkflowRule` model) but no UI to configure rules. Only manual transitions work.

---

## 🔐 Permissions & Security

Role-based access control, audit logging, and compliance features.

- [x] ~~**Role-based access (Admin, Manager, Member, Guest)**~~ — done (2025-11-20). Enum in [constants.py](backend/users/constants.py#L1-L8); permission mixin in [permissions.py](backend/core/permissions.py).
- [x] ~~**HTTPS enforced with HSTS header**~~ — done (2025-11-20). Nginx config in [nginx.conf](infra/nginx/nginx.conf#L22-L28); Django setting in [settings.py](backend/config/settings.py#L112).
- [ ] **Audit log for sensitive actions** — not implemented. Track login, role changes, data exports, and deletions in an `AuditEvent` table.
- [ ] **Two-factor authentication (TOTP)** — not implemented. Required for Admin accounts per security policy. Evaluate `django-otp`.
- [ ] **Content Security Policy (CSP) header** — not configured. Add `django-csp` with strict rules.

---

## 🧪 Testing

- [x] ~~**Unit tests for User model and serializers**~~ — done (2025-10-15). 34/34 PASSED.
- [x] ~~**Integration tests for auth endpoints**~~ — done (2025-10-18). 21/21 PASSED.
- [ ] **E2E tests with Playwright** — not configured. Critical paths: registration, login, create project, assign task, complete task.
- [ ] **Test coverage gate ≥ 80%** — current coverage ~58%. Major gaps in workflow engine and WebSocket consumers.
- [ ] **Load tests for dashboard endpoint** — not configured. Target: `GET /dashboard/` < 500ms at 100 concurrent users.

---

## ⚙️ Infrastructure & DevOps

- [x] ~~**Docker multi-stage build**~~ — done (2025-10-01). See [Dockerfile](Dockerfile); final image < 180 MB.
- [x] ~~**docker-compose for local development**~~ — done (2025-10-01). See [docker-compose.yml](docker-compose.yml). Services: `api`, `db`, `redis`, `worker`, `frontend`.
- [ ] **CI/CD pipeline (GitHub Actions)** — not configured. Workflow: lint → test → build → push image → deploy staging.
- [ ] **Kubernetes production manifests** — not present. Need Deployment, Service, Ingress with TLS, ConfigMap, and HPA.
- [ ] **Automated database backups** — not configured. Daily `pg_dump` to S3-compatible storage, 30-day retention.

---

## 🔮 Future Phase (v2.0)

Items explicitly planned for a future release. Not counted as missing for v1.0.

- [ ] **Public API with OAuth2 for third-party integrations** 🔮 — allow external apps to read/write project data.
- [ ] **Slack and Microsoft Teams notifications** 🔮 — post daily digest and assignment alerts to a configured channel.
- [ ] **Mobile PWA with offline support** 🔮 — explicitly out of scope for v1.0.
- [ ] **AI-powered task prioritization** 🔮 — auto-suggest priority based on deadlines, dependencies, and team capacity.

---

*This is an example file showing the format expected by the Open Items Tracker extension.
Copy it, rename to `open-items.md`, and adapt it to your project.*
