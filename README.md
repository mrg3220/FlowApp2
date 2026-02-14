# 🥋 FlowApp — Martial Arts Studio Management

A web application for managing martial arts studio classes, scheduling sessions, and tracking student attendance with multiple check-in methods.

## Features

- **Class Management** — Create and manage classes with discipline, skill level, capacity, and instructor assignment
- **Session Scheduling** — Create class sessions with date/time, track session status (Scheduled → In Progress → Completed)
- **Check-In System** — Three check-in methods:
  - **Admin Check-In** — Staff manually checks in students
  - **Self-Service Kiosk** — Students check in at a tablet using their email
  - **QR Code** — Students scan a session QR code (logged-in students)
- **Attendance Tracking** — Real-time attendance counts, capacity management, and detailed attendance reports
- **Role-Based Access** — Owner, Instructor, and Student roles with appropriate permissions
- **Responsive Dashboard** — See today's sessions, attendance stats, and active classes at a glance

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (JSON Web Tokens) |
| Styling | Custom CSS (no framework) |

## Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 14+ ([download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd FlowApp2

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE flowapp;
```

### 3. Environment Configuration

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your database credentials:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/flowapp?schema=public"
JWT_SECRET="generate-a-strong-random-secret-here"
```

### 4. Run Database Migrations

```bash
cd server
npx prisma migrate dev --name init
```

### 5. Seed Sample Data (Optional)

```bash
cd server
npm run db:seed
```

This creates sample accounts you can use to test:

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@flowapp.com | owner123 |
| Instructor | sensei.mike@flowapp.com | instructor123 |
| Instructor | coach.sarah@flowapp.com | instructor123 |
| Student | alex@example.com | student123 |

### 6. Start Development Servers

**Terminal 1 — API Server:**
```bash
cd server
npm run dev
```
Server runs at `http://localhost:3001`

**Terminal 2 — React Frontend:**
```bash
cd client
npm run dev
```
Frontend runs at `http://localhost:3000`

## Project Structure

```
FlowApp2/
├── docs/
│   └── database-diagram.md          # Mermaid ER diagram
├── server/                           # Express API
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema
│   │   └── seed.js                  # Seed data
│   ├── src/
│   │   ├── index.js                 # Express app entry
│   │   ├── config/                  # App config & DB client
│   │   ├── middleware/              # Auth, validation, error handling
│   │   ├── controllers/            # Route handlers
│   │   └── routes/                 # API routes
│   └── .env.example
├── client/                           # React frontend
│   ├── src/
│   │   ├── App.jsx                  # Routes & layout
│   │   ├── main.jsx                 # Entry point
│   │   ├── api/client.js           # API client
│   │   ├── context/AuthContext.jsx  # Auth state
│   │   ├── components/             # Shared components
│   │   ├── pages/                  # Page components
│   │   └── styles/                 # CSS
│   └── vite.config.js
├── .gitignore
└── README.md
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user |

### Classes
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/classes` | List all active classes |
| GET | `/api/classes/:id` | Get class details |
| POST | `/api/classes` | Create a class (staff only) |
| PUT | `/api/classes/:id` | Update a class (staff only) |
| DELETE | `/api/classes/:id` | Deactivate a class (owner only) |

### Sessions
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/sessions` | List sessions (filterable) |
| GET | `/api/sessions/:id` | Get session with attendance |
| POST | `/api/sessions` | Create a session (staff only) |
| PATCH | `/api/sessions/:id/status` | Update session status |
| GET | `/api/sessions/:id/qr` | Get session QR data |

### Check-Ins
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/checkins` | Admin check-in student |
| POST | `/api/checkins/qr` | QR code check-in |
| POST | `/api/checkins/kiosk` | Kiosk self-check-in |
| DELETE | `/api/checkins/:id` | Remove check-in |
| GET | `/api/checkins/attendance/:sessionId` | Attendance report |

### Users
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/users` | List users (staff only) |
| GET | `/api/users/:id` | Get user details |
| PUT | `/api/users/:id` | Update user (owner only) |

## Architecture Summary

### System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Desktop                          │
│                                                              │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│  │   Client     │   │     Server      │   │  PostgreSQL   │  │
│  │  (React +    │──▶│  (Node.js +     │──▶│   Database    │  │
│  │   Nginx)     │   │   Express)      │   │              │  │
│  │  Port 3000   │   │  Port 3001      │   │  Port 5432   │  │
│  └─────────────┘   └─────────────────┘   └──────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Database Schema (ER Diagram)

```mermaid
erDiagram
    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar first_name
        varchar last_name
        varchar phone
        enum role "OWNER | INSTRUCTOR | STUDENT"
        timestamp created_at
        timestamp updated_at
    }

    CLASSES {
        uuid id PK
        varchar name
        varchar discipline
        enum skill_level "BEGINNER | INTERMEDIATE | ADVANCED | ALL_LEVELS"
        int capacity
        varchar description
        uuid instructor_id FK
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    CLASS_SCHEDULES {
        uuid id PK
        uuid class_id FK
        enum day_of_week "MON-SUN"
        time start_time
        time end_time
        date effective_from
        date effective_until
        timestamp created_at
    }

    CLASS_SESSIONS {
        uuid id PK
        uuid class_id FK
        uuid schedule_id FK
        date session_date
        time start_time
        time end_time
        enum status "SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED"
        varchar qr_code UK
        timestamp created_at
        timestamp updated_at
    }

    CHECK_INS {
        uuid id PK
        uuid session_id FK
        uuid student_id FK
        enum method "ADMIN | KIOSK | QR_CODE"
        uuid checked_in_by FK
        timestamp checked_in_at
    }

    USERS ||--o{ CLASSES : "instructs"
    CLASSES ||--o{ CLASS_SCHEDULES : "has schedule"
    CLASSES ||--o{ CLASS_SESSIONS : "has sessions"
    CLASS_SCHEDULES ||--o{ CLASS_SESSIONS : "generates"
    CLASS_SESSIONS ||--o{ CHECK_INS : "has attendance"
    USERS ||--o{ CHECK_INS : "checks in"
```

### 5 Tables — Design Rationale

| Table | Purpose | Key Design Decisions |
|-------|---------|---------------------|
| **USERS** | All system users | Single table with `role` enum for RBAC — avoids join complexity for auth |
| **CLASSES** | Class templates | Soft-delete via `is_active` flag — preserves historical data |
| **CLASS_SCHEDULES** | Recurring patterns | Separate from classes to support multiple schedules per class (Mon+Wed+Fri) |
| **CLASS_SESSIONS** | Individual occurrences | Each session gets a unique `qr_code` for QR check-in; can exist without a schedule (ad-hoc sessions) |
| **CHECK_INS** | Attendance records | Unique constraint on `(session_id, student_id)` prevents duplicates; `method` tracks how student checked in |

### 3 Check-In Flows

| Flow | Auth Required | How It Works |
|------|:------------:|--------------|
| **Admin** | Yes (Staff JWT) | Staff selects session + student → `POST /api/checkins` |
| **Kiosk** | No | Student enters email at tablet → `POST /api/checkins/kiosk` |
| **QR Code** | Yes (Student JWT) | Student scans session QR → `POST /api/checkins/qr` auto-fills student from token |

### Role-Based Access Control

| Capability | Owner | Instructor | Student |
|-----------|:-----:|:----------:|:-------:|
| View dashboard & classes | ✅ | ✅ | ✅ |
| Create/edit classes | ✅ | ✅ (own) | ❌ |
| Delete (deactivate) classes | ✅ | ❌ | ❌ |
| Create/manage sessions | ✅ | ✅ | ❌ |
| Admin check-in students | ✅ | ✅ | ❌ |
| View attendance reports | ✅ | ✅ | ❌ |
| QR code self-check-in | ❌ | ❌ | ✅ |
| Manage user roles | ✅ | ❌ | ❌ |

### Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email/password authentication |
| Register | `/register` | Student self-registration |
| Dashboard | `/dashboard` | Today's sessions, stats, active classes |
| Classes | `/classes` | CRUD management with modal forms |
| Sessions | `/sessions` | Create sessions, manage status, view attendance |
| Check In | `/checkin` | Admin manual check-in with student search |
| Kiosk | `/kiosk` | Full-screen tablet-friendly self-service |

## Docker Deployment

### Quick Start with Docker

```bash
# Clone the repo
git clone <your-repo-url>
cd FlowApp2

# Start all services (PostgreSQL + Server + Client)
docker compose up --build

# Seed the database (first time only)
docker compose exec server node prisma/seed.js
```

Open `http://localhost:3000` and login with `owner@flowapp.com` / `owner123`.

### Docker Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | PostgreSQL 16 Alpine | 5432 | Database with persistent volume |
| `server` | Node.js 20 Alpine | 3001 | Express API with Prisma ORM |
| `client` | Nginx Alpine | 3000 | React SPA served via Nginx, proxies `/api` to server |

### Useful Docker Commands

```bash
# Start in background
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Reset database (destroy volume)
docker compose down -v
```

## Database Diagram

See [docs/database-diagram.md](docs/database-diagram.md) for the full Mermaid ER diagram.

## License

Private — All rights reserved.
