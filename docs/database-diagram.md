# FlowApp2 Database Schema

> **Last updated:** 2026-02-15 — Penultimate UX Overhaul  
> **Engine:** PostgreSQL 16 · **ORM:** Prisma 5.22  
> **Models:** 52 · **Enums:** 28

---

## Entity Relationship Diagrams

The schema is divided into domain groups for readability.

---

### Core — Users, Schools, Families

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        string phone
        enum role "SUPER_ADMIN | OWNER | INSTRUCTOR | STUDENT | EVENT_COORDINATOR | MARKETING | SCHOOL_STAFF"
        enum title "NONE | LOHAN_CANDIDATE | LOHAN_CERTIFIED | SIFU_ASSOCIATE | SIFU"
        string bio
        string belt_rank
        uuid school_id FK
        date date_of_birth
    }

    SCHOOLS {
        uuid id PK
        string name
        string address
        string city
        string state
        string zip
        uuid owner_id FK
        boolean is_active
    }

    FAMILIES {
        uuid id PK
        string name
        uuid school_id FK
        boolean is_active
    }

    FAMILY_MEMBERS {
        uuid id PK
        uuid family_id FK
        uuid user_id FK
        enum family_role "PRIMARY | SECONDARY | CHILD"
    }

    ENROLLMENTS {
        uuid id PK
        uuid student_id FK
        uuid school_id FK
        enum status "ACTIVE | INACTIVE | TRANSFERRED"
    }

    USERS ||--o{ SCHOOLS : "owns"
    SCHOOLS ||--o{ FAMILIES : "has"
    FAMILIES ||--o{ FAMILY_MEMBERS : "contains"
    USERS ||--o{ FAMILY_MEMBERS : "belongs to"
    USERS ||--o{ ENROLLMENTS : "enrolled"
    SCHOOLS ||--o{ ENROLLMENTS : "has students"
```

#### USERS
All system users share one table. `role` drives RBAC. `title` tracks martial arts titles (Lohan/Sifu) independently of system roles.

#### SCHOOLS
Martial arts schools. Each owned by one OWNER user. Soft-deletable via `isActive`.

#### FAMILIES
Groups related users (parent + children) within a school.

#### ENROLLMENTS
Unique constraint `[studentId, schoolId, status]` prevents duplicate active enrollments.

---

### Scheduling — Classes, Sessions, Check-Ins

```mermaid
erDiagram
    CLASSES {
        uuid id PK
        string name
        string discipline
        enum skill_level "BEGINNER | INTERMEDIATE | ADVANCED | ALL_LEVELS"
        int capacity
        uuid instructor_id FK
        uuid school_id FK
    }

    CLASS_SCHEDULES {
        uuid id PK
        uuid class_id FK
        enum day_of_week "MON-SUN"
        string start_time
        string end_time
        date effective_from
        date effective_until
    }

    CLASS_SESSIONS {
        uuid id PK
        uuid class_id FK
        uuid schedule_id FK
        date session_date
        enum status "SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED"
        string qr_code UK
    }

    CHECK_INS {
        uuid id PK
        uuid session_id FK
        uuid student_id FK
        enum method "ADMIN | KIOSK | QR_CODE"
        uuid checked_in_by FK
        timestamp checked_in_at
    }

    CLASSES ||--o{ CLASS_SCHEDULES : "schedule"
    CLASSES ||--o{ CLASS_SESSIONS : "generates"
    CLASS_SCHEDULES ||--o{ CLASS_SESSIONS : "generates"
    CLASS_SESSIONS ||--o{ CHECK_INS : "attendance"
```

---

### Billing — Plans, Invoices, Payments

```mermaid
erDiagram
    PAYMENT_CONFIGS {
        uuid id PK
        uuid school_id FK UK
        enum gateway "STRIPE | SQUARE | MANUAL"
        float tax_rate
        boolean is_active
    }

    MEMBERSHIP_PLANS {
        uuid id PK
        uuid school_id FK
        string name
        float price
        enum billing_cycle "WEEKLY | MONTHLY | QUARTERLY | SEMI_ANNUAL | ANNUAL"
    }

    INVOICES {
        uuid id PK
        string invoice_number UK
        uuid student_id FK
        float total_amount
        enum status "DRAFT | SENT | PAID | PAST_DUE | CANCELLED | REFUNDED"
        date due_date
    }

    PAYMENTS {
        uuid id PK
        uuid invoice_id FK
        float amount
        enum method "CARD | CASH | CHECK | BANK_TRANSFER | GATEWAY"
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid student_id FK
        uuid plan_id FK
        enum status "ACTIVE | PAUSED | CANCELLED"
        date next_invoice_date
    }

    MEMBERSHIP_PLANS ||--o{ INVOICES : "bills"
    MEMBERSHIP_PLANS ||--o{ SUBSCRIPTIONS : "subscribes"
    INVOICES ||--o{ PAYMENTS : "receives"
```

---

### Belt Programs — Promotions, Tests

```mermaid
erDiagram
    PROGRAMS {
        uuid id PK
        string name
        uuid school_id FK
        boolean is_global
    }

    BELTS {
        uuid id PK
        uuid program_id FK
        string name
        int display_order
        string color
    }

    BELT_REQUIREMENTS {
        uuid id PK
        uuid belt_id FK
        enum type "MIN_ATTENDANCE | TECHNIQUE | TIME_IN_RANK | MIN_AGE | ESSAY | CUSTOM"
    }

    PROGRAM_ENROLLMENTS {
        uuid id PK
        uuid student_id FK
        uuid program_id FK
        uuid current_belt_id FK
    }

    PROMOTIONS {
        uuid id PK
        uuid program_enrollment_id FK
        uuid from_belt_id FK
        uuid to_belt_id FK
        uuid promoted_by_id FK
    }

    BELT_TESTS {
        uuid id PK
        uuid program_enrollment_id FK
        uuid belt_id FK
        enum status "SCHEDULED | IN_PROGRESS | PASSED | FAILED"
    }

    PROGRAMS ||--o{ BELTS : "ranks"
    BELTS ||--o{ BELT_REQUIREMENTS : "requires"
    PROGRAMS ||--o{ PROGRAM_ENROLLMENTS : "enrolls"
    PROGRAM_ENROLLMENTS ||--o{ PROMOTIONS : "promoted"
    PROGRAM_ENROLLMENTS ||--o{ BELT_TESTS : "tested"
```

---

### Events — Venues, Tickets, Tournaments

```mermaid
erDiagram
    VENUES {
        uuid id PK
        string name
        string address
        int capacity
        uuid school_id FK
    }

    EVENTS {
        uuid id PK
        string name
        enum event_type "TOURNAMENT | SEMINAR | PARTY | CEREMONY | WORKSHOP | OTHER"
        enum scope "HQ | SCHOOL"
        uuid venue_id FK
        boolean is_public
        float ticket_price
        int max_capacity
    }

    EVENT_TICKETS {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        string guest_name
        string guest_email
        float total_price
        enum status "RESERVED | PAID | CANCELLED | REFUNDED | CHECKED_IN"
    }

    TOURNAMENT_ENTRIES {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        enum medal_type "GOLD | SILVER | BRONZE | NONE"
    }

    VENUES ||--o{ EVENTS : "hosts"
    EVENTS ||--o{ EVENT_TICKETS : "sells"
    EVENTS ||--o{ TOURNAMENT_ENTRIES : "competes"
```

---

### Retail — Products, Orders

```mermaid
erDiagram
    PRODUCTS {
        uuid id PK
        uuid school_id FK
        string name
        float price
        boolean is_org_wide
    }

    INVENTORY {
        uuid id PK
        uuid product_id FK
        string size
        string color
        int quantity
    }

    ORDERS {
        uuid id PK
        string order_number UK
        uuid customer_id FK
        enum status "PENDING | PAID | SHIPPED | DELIVERED | CANCELLED | REFUNDED"
        float total_amount
        string guest_email
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        float unit_price
    }

    PRODUCTS ||--o{ INVENTORY : "variants"
    PRODUCTS ||--o{ ORDER_ITEMS : "purchased"
    ORDERS ||--o{ ORDER_ITEMS : "contains"
```

---

### Certifications, Branding, Help, Notifications, CRM

```mermaid
erDiagram
    CERTIFICATION_APPLICATIONS {
        uuid id PK
        uuid user_id FK
        enum target_title "Title enum"
        enum status "ApplicationStatus enum"
        float fee_amount
        boolean fee_paid
    }

    ORG_BRANDING {
        uuid id PK
        string primary_color
        string secondary_color
        string font_family
    }

    SCHOOL_BRANDING {
        uuid id PK
        uuid school_id FK UK
        string logo_url
        string primary_color
    }

    HELP_ARTICLES {
        uuid id PK
        string title
        string content
        string category
        boolean is_published
    }

    ONBOARDING_PROGRESS {
        uuid id PK
        uuid user_id FK
        string step_key
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum type "NotificationType"
        enum channel "EMAIL | SMS | IN_APP"
        timestamp read_at
    }

    LEADS {
        uuid id PK
        uuid school_id FK
        enum status "NEW | CONTACTED | TRIAL_SCHEDULED | TRIAL_COMPLETED | CONVERTED | LOST"
        uuid assigned_to_id FK
    }

    USERS ||--o{ CERTIFICATION_APPLICATIONS : "applies"
    USERS ||--o{ ONBOARDING_PROGRESS : "tracks"
    USERS ||--o{ NOTIFICATIONS : "receives"
```

---

### Training, Payroll, Waivers, Certificates, Virtual Content

```mermaid
erDiagram
    TRAINING_PLANS {
        uuid id PK
        uuid school_id FK
        string name
    }

    PAYROLL_ENTRIES {
        uuid id PK
        uuid instructor_id FK
        uuid session_id FK
        float total_pay
        enum status "PENDING | APPROVED | PAID"
    }

    WAIVER_TEMPLATES {
        uuid id PK
        uuid school_id FK
        string title
    }

    WAIVERS {
        uuid id PK
        uuid template_id FK
        uuid user_id FK
        enum status "PENDING | SIGNED | EXPIRED | REVOKED"
    }

    CERTIFICATE_TEMPLATES {
        uuid id PK
        string name
        string layout_json
    }

    CERTIFICATES {
        uuid id PK
        uuid template_id FK
        uuid promotion_id FK
        string student_name
    }

    VIRTUAL_CONTENT {
        uuid id PK
        string title
        enum content_type "VIDEO | DOCUMENT | LINK"
        string url
    }

    VIDEO_VIEWS {
        uuid id PK
        uuid content_id FK
        uuid user_id FK
        int watched_seconds
        boolean completed
    }

    WAIVER_TEMPLATES ||--o{ WAIVERS : "signs"
    CERTIFICATE_TEMPLATES ||--o{ CERTIFICATES : "generates"
    VIRTUAL_CONTENT ||--o{ VIDEO_VIEWS : "viewed"
```

---

## Enum Reference

| Enum | Values |
|------|--------|
| **Role** | SUPER_ADMIN, OWNER, INSTRUCTOR, STUDENT, EVENT_COORDINATOR, MARKETING, SCHOOL_STAFF |
| **Title** | NONE, LOHAN_CANDIDATE, LOHAN_CERTIFIED, SIFU_ASSOCIATE, SIFU |
| **FamilyRole** | PRIMARY, SECONDARY, CHILD |
| **SkillLevel** | BEGINNER, INTERMEDIATE, ADVANCED, ALL_LEVELS |
| **DayOfWeek** | MON, TUE, WED, THU, FRI, SAT, SUN |
| **SessionStatus** | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED |
| **CheckInMethod** | ADMIN, KIOSK, QR_CODE |
| **EnrollmentStatus** | ACTIVE, INACTIVE, TRANSFERRED |
| **PaymentGateway** | STRIPE, SQUARE, MANUAL |
| **BillingCycle** | WEEKLY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL |
| **InvoiceStatus** | DRAFT, SENT, PAID, PAST_DUE, CANCELLED, REFUNDED |
| **PaymentMethod** | CARD, CASH, CHECK, BANK_TRANSFER, GATEWAY |
| **SubscriptionStatus** | ACTIVE, PAUSED, CANCELLED |
| **RequirementType** | MIN_ATTENDANCE, TECHNIQUE, TIME_IN_RANK, MIN_AGE, ESSAY, CUSTOM |
| **TestStatus** | SCHEDULED, IN_PROGRESS, PASSED, FAILED |
| **NotificationChannel** | EMAIL, SMS, IN_APP |
| **NotificationType** | WELCOME, BIRTHDAY, MISSED_CLASS, PAYMENT_REMINDER, PAYMENT_RECEIPT, CLASS_CHANGE, CLASS_CANCELLED, PROMOTION, TEST_SCHEDULED, INVOICE_CREATED, GENERAL, LEAD_FOLLOWUP, TRIAL_REMINDER |
| **LeadStatus** | NEW, CONTACTED, TRIAL_SCHEDULED, TRIAL_COMPLETED, CONVERTED, LOST |
| **LeadSource** | WEBSITE, REFERRAL, WALK_IN, SOCIAL_MEDIA, ADVERTISING, EVENT, OTHER |
| **WaiverStatus** | PENDING, SIGNED, EXPIRED, REVOKED |
| **OrderStatus** | PENDING, PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| **PayrollStatus** | PENDING, APPROVED, PAID |
| **MedalType** | GOLD, SILVER, BRONZE, NONE |
| **ContentType** | VIDEO, DOCUMENT, LINK |
| **EventType** | TOURNAMENT, SEMINAR, PARTY, CEREMONY, WORKSHOP, OTHER |
| **EventScope** | HQ, SCHOOL |
| **TicketStatus** | RESERVED, PAID, CANCELLED, REFUNDED, CHECKED_IN |
| **ApplicationStatus** | DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, DENIED, WITHDRAWN |

---

## Security Notes

- **Password hashes** use bcrypt cost factor 12 — plaintext passwords are never stored
- **Gateway secret keys** in PaymentConfig should be encrypted at rest in production
- **Signature data** in Waivers stores base64 images — treat as PII
- **IP addresses** in Waivers are stored for audit trails
- **Guest PII** (name, email, phone) in EventTickets and Orders must comply with privacy regulations
- The `applicationData` JSON field in CertificationApplications may contain personal information
