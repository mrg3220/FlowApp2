# FlowApp Database Schema

## Entity Relationship Diagram

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
        varchar discipline "e.g. Karate, BJJ, Kickboxing"
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
        enum day_of_week "MON | TUE | WED | THU | FRI | SAT | SUN"
        time start_time
        time end_time
        date effective_from
        date effective_until "nullable - null means ongoing"
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
        varchar qr_code "unique code for QR check-in"
        timestamp created_at
        timestamp updated_at
    }

    CHECK_INS {
        uuid id PK
        uuid session_id FK
        uuid student_id FK
        enum method "ADMIN | KIOSK | QR_CODE"
        uuid checked_in_by "nullable - admin who checked them in"
        timestamp checked_in_at
    }

    USERS ||--o{ CLASSES : "instructs"
    CLASSES ||--o{ CLASS_SCHEDULES : "has schedule"
    CLASSES ||--o{ CLASS_SESSIONS : "has sessions"
    CLASS_SCHEDULES ||--o{ CLASS_SESSIONS : "generates"
    CLASS_SESSIONS ||--o{ CHECK_INS : "has attendance"
    USERS ||--o{ CHECK_INS : "checks in as student"
    USERS ||--o{ CHECK_INS : "checked in by admin"
```

## Table Descriptions

### USERS
All system users — owners, instructors, and students share one table with a `role` field for role-based access control.

### CLASSES
Defines a class template (e.g., "Monday Night BJJ"). Linked to an instructor and contains metadata like discipline, skill level, and capacity.

### CLASS_SCHEDULES
Recurring schedule definitions. A class can have multiple schedules (e.g., BJJ runs Mon/Wed/Fri at 6pm).

### CLASS_SESSIONS
Individual occurrences of a class. Generated from schedules or created manually. Each session gets a unique QR code for check-in.

### CHECK_INS
Attendance records. Tracks which student checked into which session, when, and how (admin, kiosk, or QR code).
