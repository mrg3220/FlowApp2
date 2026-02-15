# Security Architecture — FlowApp2

> Last updated: 2025-02 (production audit)

This document describes the security controls implemented across the FlowApp2 stack. It is intended for security auditors, penetration testers, and developers joining the project.

---

## 1. Authentication

| Layer | Control | Implementation |
|-------|---------|---------------|
| Token format | JWT Bearer tokens | `jsonwebtoken` library, HS256 |
| Token verification | Every authenticated request | `middleware/auth.js → authenticate()` |
| User lookup | DB verification per request | Prevents use of tokens for deleted users |
| Token structure | 3-segment format guard | Rejects malformed tokens before `jwt.verify` |
| Error messages | Generic 401 responses | Prevents user enumeration |

### Token Flow
1. Client sends `Authorization: Bearer <token>` header
2. `authenticate` middleware verifies signature + expiry via `jwt.verify()`
3. Fetches full user from database (no stale token cache)
4. Attaches user object to `req.user` for downstream handlers

---

## 2. Authorization (RBAC + IDOR Prevention)

### Role Hierarchy
```
SUPER_ADMIN          — platform-wide access, all schools
IT_ADMIN             — platform-wide read, system diagnostics
OWNER                — full access to own school
INSTRUCTOR           — class/session/student management for own school
STUDENT / PARENT     — read-only for own records
SCHOOL_STAFF         — administrative tasks for own school
MARKETING            — org branding access
EVENT_COORDINATOR    — event/venue management for own school
```

### IDOR Prevention (Insecure Direct Object Reference)
Every controller that modifies or reads school-scoped data uses the **fetch-first-then-compare** pattern:

```javascript
// 1. Fetch the resource
const resource = await prisma.model.findUnique({ where: { id } });
if (!resource) return res.status(404).json({ error: 'Not found' });

// 2. Verify school ownership (super roles bypass)
if (!canAccessSchool(req.user, resource.schoolId)) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

Shared helpers in `utils/authorization.js`:
- `isSuperRole(user)` — checks SUPER_ADMIN / IT_ADMIN
- `schoolScope(user)` — builds school-scoped `where` clause
- `canAccessSchool(user, resourceSchoolId)` — ownership check

### Affected Controllers (all 32)
All controllers now enforce school-level scoping. See ARCHITECTURE.md for the full list.

---

## 3. Input Validation

### Defense-in-Depth Strategy (two layers)

**Layer 1: Route-level validation** (express-validator)
- All 32 route files have express-validator chains on write endpoints
- Validates types, formats (UUID, ISO8601, email), lengths, ranges
- Centralized error handler: `middleware/validate.js`

**Layer 2: Controller-level field whitelisting**
- Every controller uses explicit field destructuring or `pickFields()` helpers
- Unknown/injected fields (e.g., `role`, `schoolId`, `isAdmin`) are silently dropped
- No controller uses `...req.body` or `data: req.body`

### Password Complexity
Profile password changes require:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

---

## 4. Rate Limiting

| Limiter | Scope | Window | Max Requests |
|---------|-------|--------|-------------|
| Global | All routes | 15 min | 100 |
| Auth | `/api/auth/*` | 15 min | 20 |
| Public writes | `/api/public` (POST) | 15 min | 30 |

Implementation: `express-rate-limit` in `server/src/index.js`

---

## 5. HTTP Security Headers

### Server (Express + Helmet)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (modern CSP preferred)
- `Strict-Transport-Security` (when behind HTTPS proxy)
- Content-Security-Policy defaults

### Client (Nginx)
Additional hardening in `client/nginx.conf`:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 6. Docker Container Security

| Control | Server | Client | Database |
|---------|--------|--------|----------|
| `no-new-privileges` | ✅ | ✅ | ✅ |
| `read_only` filesystem | ✅ | ✅ | ❌ (needs writes) |
| Non-root user | ✅ (appuser:1001) | ✅ (nginx) | ✅ (postgres) |
| tmpfs for writeable paths | ✅ `/tmp`, `/app/.prisma` | ✅ `/var/cache/nginx`, `/var/run`, `/tmp` | N/A |
| Network segmentation | Backend only | Backend + Frontend | Backend only |
| Multi-stage build | ✅ (build → runtime) | ✅ (build → nginx) | N/A |
| `noexec` on tmpfs | ✅ `/tmp` | ✅ `/tmp` | N/A |

---

## 7. CORS Policy

- **Allowed origins**: configurable via `CORS_ORIGIN` env var
- **Allowed methods**: GET, POST, PUT, PATCH, DELETE
- **Allowed headers**: Content-Type, Authorization
- **Pre-flight cache**: 600 seconds
- **Credentials**: not enabled (token-based auth via header)

---

## 8. Graceful Shutdown

The server handles SIGTERM/SIGINT for clean shutdown:
1. Stops accepting new connections
2. Waits for in-flight requests to complete
3. Disconnects Prisma database client
4. Exits with code 0
5. Forced exit after 10 seconds if cleanup hangs

---

## 9. Body Size Limits

- JSON body limit: **10kb** (Express built-in)
- Prevents large payload DoS attacks

---

## 10. Known Limitations & Future Work

- **No CSRF protection** — not needed for pure API (token in Authorization header)
- **No request signing** — acceptable for internal API; consider for webhook endpoints
- **JWT in local storage** — client-side; consider HttpOnly cookies for XSS mitigation
- **No audit log table** — consider adding for compliance (SOC2, HIPAA)
- **No WAF** — consider Cloudflare/AWS WAF in front of Nginx for production
