# Open Items — Demo Project

## 👤 User Management

Handles registration, authentication, and profile management.

- [x] ~~**User registration with email verification**~~ — done (2025-10-01). Implemented with Django allauth.
- [ ] **OAuth2 login (Google, GitHub)** 🔄 — Google done, GitHub in progress.
- [ ] **Dark mode preference sync** — not implemented.
- [ ] **Profile avatar upload** — not implemented.

### Account Settings

- [x] ~~**Password change flow**~~ — done (2025-10-15). With email notification.
- [ ] **Two-factor authentication (2FA)** 🔮 — planned for Q2 2026.
- [ ] **Account deletion with data export** — not implemented.

---

## 📊 Dashboard & Analytics

Main analytics dashboard with KPI cards and charts.

- [x] ~~**Monthly active users chart**~~ — done (2025-11-01). Chart.js line chart.
- [ ] **Revenue tracker card** — not implemented.
- [ ] **Team velocity chart (burn-down)** — not implemented.

---

## 🔒 Security & Compliance

Security hardening and compliance requirements.

- [x] ~~**Rate limiting on auth endpoints**~~ — done (2025-09-20). Django-ratelimit.
- [ ] **Content Security Policy (CSP) header** — not configured.
- [ ] **GDPR data export endpoint** — not implemented.

---

## 🧪 Testing

- [x] ~~**Unit tests for user model**~~ — done (2025-10-01). 95% coverage.
- [x] ~~**Integration tests for auth flow**~~ — done (2025-10-15). Pytest + factory_boy.
- [ ] **Load tests for dashboard endpoint** — not implemented.
