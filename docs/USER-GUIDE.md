# FlowApp User Guide

> 🥋 Martial Arts Studio Management Platform

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Classes & Sessions](#classes--sessions)
4. [Check-In System](#check-in-system)
5. [Events & Tournaments](#events--tournaments)
6. [Billing & Payments](#billing--payments)
7. [Promotions & Belt System](#promotions--belt-system)
8. [Retail / Pro Shop](#retail--pro-shop)
9. [Help Center](#help-center)
10. [Role-Based Features](#role-based-features)

---

## Getting Started

### Logging In

1. Navigate to `http://localhost:3000/login` (or your deployed URL)
2. Enter your email and password
3. Click **Login**

### First-Time Users

If you're a new student, click **Register** on the login page and fill in:
- First Name, Last Name
- Email Address
- Password (min 6 characters)

Your account will be created with the **Student** role.

---

## Dashboard

The Dashboard is your home page after logging in. It shows:

- **Today's Sessions** — Classes scheduled for today
- **Recent Attendance** — Your check-in history (students) or studio attendance stats (staff)
- **Quick Actions** — Check-in, view schedule, manage classes
- **Upcoming Events** — Tournaments, seminars, and special events

---

## Classes & Sessions

### Viewing Classes

Navigate to **Classes** from the sidebar to see all active classes. Each class card shows:

- Class name and discipline (Karate, Jiu-Jitsu, Taekwondo, etc.)
- Skill level (Beginner, Intermediate, Advanced, All Levels)
- Maximum capacity
- Assigned instructor

### Sessions

**Sessions** are individual occurrences of classes with specific dates and times.

To view sessions:
1. Click **Sessions** in the sidebar
2. Use the date filter to navigate weeks
3. Click any session to see details and attendance

**Staff/Instructors can:**
- Create new sessions
- Update session status (Scheduled → In Progress → Completed → Cancelled)
- View and manage attendance

---

## Check-In System

FlowApp offers three ways to check in students:

### 1. Admin Check-In (Staff)

1. Go to **Check-In** page
2. Select the active session
3. Search for the student by name/email
4. Click **Check In**

### 2. Kiosk Mode (Self-Service)

1. Access `/kiosk` URL on a tablet or designated station
2. Students enter their email
3. System finds their enrolled sessions
4. Student confirms check-in

### 3. QR Code Check-In

1. Staff generates a session QR code from the Sessions page
2. Display the QR code on a screen
3. Students scan with their phone (must be logged in)
4. Automatic attendance recording

---

## Events & Tournaments

### Viewing Events

Navigate to **Events** to see upcoming:
- Tournaments
- Seminars & Workshops
- Belt Tests
- Special Events

### Registering for Events

1. Click on an event card
2. Review event details, date, venue, and fees
3. Click **Register**
4. For paid events, complete the payment process

### Tournament Features

- **Bracket Management** — View tournament brackets
- **Medal Tracking** — Student medal history
- **Event Categories** — Age/belt divisions

---

## Billing & Payments

### For Students

- **My Billing** — View your invoices and payment history
- **Membership Plans** — See your active subscription
- **Make Payment** — Pay outstanding invoices

### For Staff/Owners

- **Invoices** — Create and manage invoices
- **Subscriptions** — Manage student memberships
- **Payment History** — Track all payments
- **Financial Reports** — Revenue analytics

---

## Promotions & Belt System

### Student View

- **My Progress** — See your current belt and progress toward the next rank
- **Requirements** — View techniques and requirements for promotion
- **Belt Tests** — Register for upcoming belt tests
- **Essays** — Submit essays for higher rank promotions

### Staff View

- **Programs** — Manage belt/rank systems by discipline
- **Requirements** — Define promotion criteria
- **Schedule Tests** — Create belt testing events
- **Review Progress** — Evaluate student readiness

---

## Retail / Pro Shop

### For Students

- **Shop** — Browse products (uniforms, equipment, merchandise)
- **My Orders** — View order history

### For Staff

- **Inventory** — Manage product stock
- **Orders** — Process and fulfill orders
- **Low Stock Alerts** — Monitor inventory levels

---

## Help Center

Access the **Help** section from the sidebar to find:

- **Knowledge Base** — Articles organized by category
- **Search** — Find help on specific topics
- **Role-Based Content** — See articles relevant to your role
- **AI Chat Assistant** — Ask questions and get instant help

### Categories

- 🚀 Getting Started
- 🥋 Classes
- 🎪 Events
- 💰 Billing
- 📈 Promotions
- 🎓 Students
- ⚙️ Administration

---

## Role-Based Features

Different users see different features based on their role:

### Student
- View enrolled classes and schedule
- Check-in to sessions
- Track promotion progress
- Register for events
- Access student portal
- View waivers and certificates

### Instructor
- All student features, plus:
- Manage sessions they teach
- Check in students
- View attendance reports
- Manage leads/prospects

### School Staff
- All instructor features, plus:
- Manage classes
- Process retail orders
- Manage waivers
- View school reports

### Owner
- Full access to all features, plus:
- Financial reporting
- Payroll management
- School settings
- User management

### Super Admin / IT Admin
- System-wide administration
- Multi-school management
- Audit logs
- System health monitoring

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Quick search |
| `Esc` | Close modal/dialog |

---

## Getting Help

1. **In-App Help** — Click **Help** in the sidebar
2. **Knowledge Base** — Browse categorized articles
3. **Contact Support** — Email support@flowapp.com

---

## Version

This guide covers FlowApp version 2.x with the 2025-02 production updates.
