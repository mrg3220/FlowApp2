# 🥋 FlowApp — Enterprise Martial Arts Studio Management

A comprehensive web application for managing martial arts organizations with multi-school support, belt promotions, billing, events, and more.

## Features

### Core Operations
- **Multi-School Management** — Support for multiple schools under one organization, each with their own branding
- **Class Management** — Create and manage classes with program/discipline, skill level, capacity, and instructor assignment
- **Recurring Schedules** — Set weekly recurring class schedules (e.g., Mon/Wed/Fri 6-7 PM) with automatic session generation
- **Session Management** — Individual class sessions with date/time, status tracking, and QR codes
- **Calendar View** — Monthly calendar showing all sessions, events, and scheduled classes

### Check-In System
- **Admin Check-In** — Staff manually checks in students
- **Self-Service Kiosk** — Students check in at a tablet using their email
- **QR Code** — Students scan a session QR code (logged-in students)
- **Attendance Tracking** — Real-time attendance counts, capacity management, and detailed reports

### Belt Promotion System
- **Programs & Belts** — Define martial arts programs with customizable belt/rank structures
- **Requirements** — Set promotion requirements (attendance, time in rank, techniques, essays)
- **Progress Tracking** — Track student progress toward next belt
- **Belt Tests** — Schedule and manage belt testing events
- **Certificates** — Generate promotion certificates with customizable templates

### Billing & Payments
- **Membership Plans** — Create flexible plans (monthly, quarterly, annual, class credits)
- **Invoices** — Generate and track invoices with tax calculation
- **Payments** — Record payments (card, cash, check, bank transfer)
- **Subscriptions** — Manage recurring student subscriptions
- **Payment Gateway Integration** — Support for Stripe and Square

### Events System
- **Event Types** — Tournaments, seminars, parties, ceremonies, workshops
- **Venue Management** — Track venues with capacity and contact info
- **Ticket Sales** — Sell event tickets with guest checkout support
- **Tournament Entries** — Track competitors, weight classes, divisions, and medals
- **Registration** — Event registration with waitlist support

### Additional Features
- **Lead Management (CRM)** — Track prospects from initial contact to conversion
- **Family Accounts** — Group family members under one household
- **Digital Waivers** — Create waiver templates and collect digital signatures
- **Retail/Inventory** — Manage products, inventory, and orders
- **Curriculum Library** — Store techniques with videos and descriptions
- **Training Plans** — Create and assign workout plans
- **Instructor Payroll** — Track hours and calculate instructor pay
- **Virtual Content** — Host online training videos by belt level
- **Notifications** — Email, SMS, and in-app notifications with templates
- **Branding** — Organization and per-school branding customization
- **Certifications** — Instructor title application and review process
- **Help System** — Role-based help articles and onboarding
- **Audit Logging** — Track all administrative actions

### Role-Based Access Control

| Role | Description |
|------|-------------|
| **Super Admin** | Full system access, manages all schools |
| **Owner** | Manages their school(s), staff, and settings |
| **Instructor** | Manages classes, sessions, and check-ins |
| **Student** | Views schedule, checks in, tracks progress |
| **Event Coordinator** | Manages events and tournaments |
| **Marketing** | Access to leads and promotions |
| **School Staff** | Limited administrative access |
| **IT Admin** | System settings and user management |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Backend | Node.js 20 + Express 4.21 |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT (JSON Web Tokens) |
| Styling | Custom CSS (no framework) |
| Containerization | Docker + Docker Compose |

## Prerequisites

### Docker (Recommended)
- **Docker Desktop** ([download](https://www.docker.com/products/docker-desktop/))

### Local Development
- **Node.js** 20+ ([download](https://nodejs.org/))
- **PostgreSQL** 16+ ([download](https://www.postgresql.org/download/))

## Quick Start with Docker

```bash
# Clone the repo
git clone https://github.com/mrg3220/FlowApp2.git
cd FlowApp2

# Start all services
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
| `client` | Nginx Alpine | 3000 | React SPA served via Nginx |

### Docker Commands

```bash
docker compose up -d --build     # Start in background
docker compose logs -f           # View logs
docker compose down              # Stop all services
docker compose down -v           # Reset database (destroy volume)
```

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/mrg3220/FlowApp2.git
cd FlowApp2

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Database Setup

```sql
CREATE DATABASE flowapp;
```

### 3. Environment Configuration

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/flowapp?schema=public"
JWT_SECRET="generate-a-strong-random-secret-here"
```

### 4. Run Migrations

```bash
cd server
npx prisma migrate dev
```

### 5. Seed Sample Data

```bash
npm run db:seed
```

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@flowapp.com | owner123 |
| Instructor | sensei.mike@flowapp.com | instructor123 |
| Student | alex@example.com | student123 |

### 6. Start Development Servers

```bash
# Terminal 1 — API Server
cd server && npm run dev    # http://localhost:3001

# Terminal 2 — Frontend
cd client && npm run dev    # http://localhost:3000
```

## Project Structure

```
FlowApp2/
├── client/                           # React frontend
│   ├── src/
│   │   ├── api/client.js            # API client
│   │   ├── context/AuthContext.jsx  # Auth state
│   │   ├── pages/                   # Page components
│   │   └── styles/                  # CSS
│   ├── nginx.conf                   # Production config
│   └── Dockerfile
├── server/                           # Express API
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (50+ models)
│   │   └── seed.js                  # Seed data
│   ├── src/
│   │   ├── controllers/             # Route handlers
│   │   ├── middleware/              # Auth, validation
│   │   └── routes/                  # API routes
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Database Schema

### Core Models (50+)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORGANIZATION                                 │
├─────────────────────────────────────────────────────────────────────┤
│  User, School, Family, FamilyMember, Enrollment                     │
│  OrgBranding, SchoolBranding                                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      CLASS MANAGEMENT                                │
├─────────────────────────────────────────────────────────────────────┤
│  Class, ClassSchedule, ClassSession, CheckIn                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     BELT PROMOTIONS                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Program, Belt, BeltRequirement, ProgramEnrollment                  │
│  RequirementProgress, Promotion, BeltTest, EssaySubmission          │
│  CertificateTemplate, Certificate                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         BILLING                                      │
├─────────────────────────────────────────────────────────────────────┤
│  PaymentConfig, MembershipPlan, Invoice, Payment, Subscription      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          EVENTS                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Venue, Event, EventTicket, EventRegistration, TournamentEntry      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       ADDITIONAL                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Lead, LeadActivity (CRM)                                           │
│  WaiverTemplate, Waiver (Digital Waivers)                           │
│  Product, Inventory, Order, OrderItem (Retail)                      │
│  CurriculumItem (Technique Library)                                 │
│  TrainingPlan, TrainingPlanExercise, TrainingPlanAssignment         │
│  PayrollEntry (Instructor Payroll)                                  │
│  VirtualContent, VideoView (Online Classes)                         │
│  NotificationTemplate, Notification, NotificationPreference         │
│  CertificationApplication (Title Applications)                      │
│  HelpArticle, OnboardingProgress (Help System)                      │
│  AuditLog, SystemSetting (IT Administration)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Relationships

```mermaid
erDiagram
    School ||--o{ Class : has
    School ||--o{ Enrollment : enrolls
    School ||--o{ Event : hosts
    
    Class ||--o{ ClassSchedule : "scheduled on"
    Class ||--o{ ClassSession : "has sessions"
    ClassSchedule ||--o{ ClassSession : generates
    ClassSession ||--o{ CheckIn : "tracks attendance"
    
    User ||--o{ Enrollment : "enrolled at"
    User ||--o{ CheckIn : "checks into"
    User ||--o{ ProgramEnrollment : "enrolled in"
    
    Program ||--o{ Belt : "has ranks"
    Belt ||--o{ BeltRequirement : "requires"
    ProgramEnrollment ||--o{ Promotion : "promoted through"
    
    MembershipPlan ||--o{ Subscription : "subscribed to"
    Invoice ||--o{ Payment : "paid by"
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Current user |

### Classes & Sessions
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/classes` | List classes |
| POST | `/api/classes` | Create class |
| POST | `/api/classes/:id/schedules` | Add recurring schedule |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| PATCH | `/api/sessions/:id/status` | Update status |

### Check-Ins
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/checkins` | Admin check-in |
| POST | `/api/checkins/kiosk` | Kiosk self-check-in |
| POST | `/api/checkins/qr` | QR code check-in |

### Billing
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/billing/summary/:schoolId` | Billing dashboard |
| POST | `/api/billing/plans` | Create membership plan |
| POST | `/api/billing/invoices` | Create invoice |
| POST | `/api/billing/payments` | Record payment |

### Promotions
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/promotions/programs` | List programs |
| POST | `/api/promotions/promote/:enrollmentId` | Promote student |
| POST | `/api/promotions/tests` | Schedule belt test |

### Events
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/events` | List events |
| POST | `/api/events` | Create event |
| POST | `/api/events/:id/tickets` | Purchase ticket |
| POST | `/api/events/:id/register` | Register for event |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Today's sessions, stats, calendar preview |
| Classes | `/classes` | Manage classes and schedules |
| Sessions | `/sessions` | View/create sessions, grouped by program |
| Calendar | `/calendar` | Monthly view of all events |
| Check In | `/checkin` | Admin check-in interface |
| Kiosk | `/kiosk` | Full-screen tablet kiosk |
| Billing | `/billing` | Plans, invoices, payments |
| Promotions | `/promotions` | Belt programs and progress |
| Events | `/events` | Event management |
| Schools | `/schools` | Multi-school management |
| Users | `/users` | User administration |
| Branding | `/branding` | School branding settings |
| Certificates | `/certificates` | Generated certificates |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Desktop                          │
│                                                              │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐  │
│  │   Client    │   │     Server      │   │  PostgreSQL  │  │
│  │  (React +   │──▶│  (Node.js +     │──▶│   Database   │  │
│  │   Nginx)    │   │   Express)      │   │              │  │
│  │  Port 3000  │   │  Port 3001      │   │  Port 5432   │  │
│  └─────────────┘   └─────────────────┘   └──────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## License

Private — All rights reserved.
