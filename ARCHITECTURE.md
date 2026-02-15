# Architecture Guide — FlowApp2

> Martial Arts Studio Management Platform  
> Last updated: 2025-02 (production audit)

---

## Stack Overview

```
┌──────────────────────────────────────────────────────┐
│  CLIENT (React 18 + Vite 5)                          │
│  Served by Nginx 1.27 on port 3000                   │
│  SPA with client-side routing                        │
└──────────────┬───────────────────────────────────────┘
               │ HTTP (JSON API)
┌──────────────▼───────────────────────────────────────┐
│  SERVER (Node.js 20 + Express 4.21)                  │
│  Port 3001 — JSON REST API                           │
│  ├── middleware/   (auth, validation, metrics, error) │
│  ├── routes/       (32 route files with validation)  │
│  ├── controllers/  (32 controllers with IDOR checks) │
│  ├── services/     (scheduling, notifications)       │
│  ├── utils/        (pagination, authorization)       │
│  └── config/       (env, database)                   │
└──────────────┬───────────────────────────────────────┘
               │ Prisma ORM
┌──────────────▼───────────────────────────────────────┐
│  DATABASE (PostgreSQL 16)                            │
│  Port 5432 — ~54 models, 29 enums                    │
│  Managed via Prisma Migrate                          │
└──────────────────────────────────────────────────────┘
```

All three services run in Docker containers orchestrated by `docker-compose.yml`.

---

## Directory Structure

```
FlowApp2/
├── docker-compose.yml          # Container orchestration
├── .env / .env.example         # Environment configuration
├── SECURITY.md                 # Security architecture docs
├── ARCHITECTURE.md             # This file
│
├── server/
│   ├── Dockerfile              # Multi-stage Node.js 20 Alpine
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (~54 models)
│   │   ├── migrations/         # Prisma migrations
│   │   ├── seed.js             # Database seeder
│   │   └── seed-notifications.js
│   └── src/
│       ├── index.js            # Express app entry point
│       ├── config/
│       │   ├── index.js        # Environment config
│       │   └── database.js     # Prisma client singleton
│       ├── middleware/
│       │   ├── auth.js         # JWT authenticate + RBAC authorize
│       │   ├── validate.js     # express-validator error handler
│       │   ├── errorHandler.js # Global error handler
│       │   └── requestMetrics.js # Request timing/counting
│       ├── routes/             # 32 route files (express-validator)
│       ├── controllers/        # 32 controller files
│       ├── services/           # Background services
│       └── utils/
│           ├── pagination.js   # parsePagination, paginatedResponse
│           └── authorization.js # isSuperRole, schoolScope, canAccessSchool
│
└── client/
    ├── Dockerfile              # Multi-stage Vite build → Nginx
    ├── nginx.conf              # Production Nginx configuration
    ├── package.json
    └── src/                    # React SPA source
```

---

## Request Lifecycle

```
Client Request
  │
  ▼
Nginx (port 3000)
  │ /api/* → proxy_pass to server:3001
  │ /*     → serve React SPA (index.html fallback)
  │
  ▼
Express Middleware Stack (server:3001)
  │
  ├── 1. helmet()               — Security headers
  ├── 2. cors()                 — CORS policy
  ├── 3. express.json()         — Body parsing (10kb limit)
  ├── 4. requestMetrics         — Timing + counting
  ├── 5. globalLimiter          — Rate limit (100/15min)
  ├── 6. authenticate           — JWT verification (per route)
  ├── 7. authorize(roles...)    — RBAC gate (per route)
  ├── 8. express-validator      — Input validation (per route)
  ├── 9. validate middleware    — Collect validation errors → 400
  ├── 10. Controller            — Business logic + IDOR checks
  │       ├── Field whitelist   — Mass assignment protection
  │       ├── schoolScope()     — Automatic school scoping
  │       └── canAccessSchool() — Resource ownership check
  │
  ├── 404 handler               — Unknown routes
  └── errorHandler              — Global error catch
```

---

## Controller Patterns

### Field Whitelisting (Mass Assignment Prevention)
Every write controller uses one of two patterns:

**Pattern A: Destructuring**
```javascript
const { name, description, date } = req.body;  // Only pick known fields
await prisma.model.create({ data: { name, description, date, schoolId: req.user.schoolId } });
```

**Pattern B: Pick helper**
```javascript
const ALLOWED_FIELDS = ['name', 'description', 'date', 'location'];
function pickFields(body) {
  const data = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  return data;
}
```

### Pagination
All list endpoints use shared pagination utilities:
```javascript
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function listItems(req, res) {
  const { skip, take, page, limit } = parsePagination(req.query);
  const where = schoolScope(req.user);
  const [data, total] = await Promise.all([
    prisma.model.findMany({ where, skip, take }),
    prisma.model.count({ where }),
  ]);
  res.json(paginatedResponse(data, total, page, limit));
}
```

Response format:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 142,
    "totalPages": 3
  }
}
```

---

## Docker Architecture

### Network Topology
```
                   ┌─────────────────────────┐
                   │     Host Machine         │
                   │  ports 3000, 3001, 5432  │
                   └──────┬──────────────┬────┘
                          │              │
              ┌───────────▼──────┐  ┌────▼────────────────┐
              │ frontend network │  │  backend network     │
              │   (bridge)       │  │  (internal)          │
              │                  │  │                      │
              │  ┌────────────┐  │  │  ┌───────────────┐   │
              │  │  client    │──┼──┼──│  server        │   │
              │  │  :3000     │  │  │  │  :3001         │   │
              │  └────────────┘  │  │  └───────┬───────┘   │
              └──────────────────┘  │          │           │
                                    │  ┌───────▼───────┐   │
                                    │  │  db (postgres) │   │
                                    │  │  :5432         │   │
                                    │  └───────────────┘   │
                                    └──────────────────────┘
```
- **backend** network is `internal: true` — no external access to DB
- **server** bridges both networks (accepts client requests, talks to DB)
- **client** (Nginx) is the only public-facing container

### Security Controls
- All containers: `security_opt: no-new-privileges:true`
- Server + Client: `read_only: true` with tmpfs for required writable dirs
- Non-root users in all containers
- Multi-stage builds (no dev dependencies in production images)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs (min 32 chars recommended) |
| `CORS_ORIGIN` | Yes | Allowed CORS origins (comma-separated) |
| `NODE_ENV` | No | `production` / `development` (default: development) |
| `PORT` | No | API server port (default: 3001) |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |

---

## Common Operations

### Start development environment
```bash
docker compose up -d
```

### Rebuild after code changes
```bash
docker compose up -d --build server
```

### Run database migrations
```bash
docker compose exec server npx prisma migrate dev
```

### Seed database
```bash
docker compose exec server node prisma/seed.js
```

### View server logs
```bash
docker compose logs -f server
```

### Open Prisma Studio (DB GUI)
```bash
cd server && npx prisma studio
```

---

## Controller / Route Inventory

| # | Route prefix | File | Auth | Write validation |
|---|-------------|------|------|-----------------|
| 1 | `/api/auth` | auth.js | Public (login/register) | ✅ |
| 2 | `/api/schools` | schools.js | Authenticated | ✅ |
| 3 | `/api/classes` | classes.js | Authenticated | ✅ |
| 4 | `/api/sessions` | sessions.js | Authenticated | ✅ |
| 5 | `/api/checkins` | checkins.js | Authenticated | ✅ |
| 6 | `/api/users` | users.js | Authenticated | ✅ |
| 7 | `/api/enrollments` | enrollments.js | Authenticated | ✅ |
| 8 | `/api/profile` | profile.js | Authenticated | ✅ |
| 9 | `/api/metrics` | metrics.js | Authenticated | Read-only |
| 10 | `/api/billing` | billing.js | Authenticated | ✅ |
| 11 | `/api/promotions` | promotions.js | Authenticated | ✅ |
| 12 | `/api/notifications` | notifications.js | Authenticated | ✅ |
| 13 | `/api/families` | families.js | Authenticated | ✅ |
| 14 | `/api/student-portal` | studentPortal.js | Authenticated | Read-only |
| 15 | `/api/leads` | leads.js | Authenticated | ✅ |
| 16 | `/api/curriculum` | curriculum.js | Authenticated | ✅ |
| 17 | `/api/reporting` | reporting.js | Authenticated | Read-only |
| 18 | `/api/waivers` | waivers.js | Authenticated | ✅ |
| 19 | `/api/retail` | retail.js | Authenticated | ✅ |
| 20 | `/api/certificates` | certificates.js | Authenticated | ✅ |
| 21 | `/api/training-plans` | trainingPlans.js | Authenticated | ✅ |
| 22 | `/api/payroll` | payroll.js | Authenticated | ✅ |
| 23 | `/api/events` | events.js | Authenticated | ✅ |
| 24 | `/api/venues` | venues.js | Authenticated | ✅ |
| 25 | `/api/certifications` | certifications.js | Authenticated | ✅ |
| 26 | `/api/branding` | branding.js | Authenticated | ✅ |
| 27 | `/api/help` | help.js | Authenticated | ✅ |
| 28 | `/api/virtual` | virtual.js | Authenticated | ✅ |
| 29 | `/api/competitions` | competitions.js | Authenticated | ✅ |
| 30 | `/api/admin` | admin.js | SUPER_ADMIN / IT_ADMIN | ✅ |
| 31 | `/api/sre` | sre.js | SUPER_ADMIN / IT_ADMIN | Read-only |
| 32 | `/api/public` | public.js | Public | ✅ |
