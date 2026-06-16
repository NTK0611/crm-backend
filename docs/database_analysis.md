# Database Analysis — CRM Backend

## Overview

This document describes the database design for the Realtime CRM / Customer Support system.
The database uses PostgreSQL with 12 entities organized into 4 domains.

---

## Domains

### 1. People
Manages internal users (staff/admin) and external customers separately.

### 2. Conversations
The core of the CRM — support tickets and the messages within them.

### 3. Actions & Events
Tracks what happens to conversations — assignments, status changes, notifications, webhooks.

### 4. Files
Attachments sent within messages.

---

## Entity Relationships

### users
- Has many `user_roles` (many-to-many with `roles` via junction table)
- Joins many `conversations` via `conversation_members`
- Can be `assigned_to` or `assigned_by` in `assignments`
- Receives `notifications`
- Performs `activity_logs`

### roles
- Has many `user_roles`
- Three fixed values: `ADMIN`, `STAFF`, `CUSTOMER`

### user_roles *(junction table)*
- Connects `users` ↔ `roles` (many-to-many)
- Composite primary key: `(user_id, role_id)` — prevents duplicate role assignments
- `onDelete: Cascade` — deleting a user removes their role assignments

### customers
- Has many `conversations`
- Separate from `users` — customers are external, users are internal staff

### conversations
- Belongs to one `customer` (many-to-one)
- Has many `conversation_members` (which staff are involved)
- Has many `messages`
- Has many `assignments`
- Has many `activity_logs`
- Status lifecycle: `OPEN` → `ASSIGNED` → `PENDING` → `CLOSED`

### conversation_members *(junction table)*
- Connects `users` ↔ `conversations` (many-to-many)
- Unique constraint on `(conversation_id, user_id)` — a user can't join the same conversation twice
- `onDelete: Cascade` — deleting a conversation removes all member records

### messages
- Belongs to one `conversation`
- `sender_id` + `sender_type` pattern handles both `USER` and `CUSTOMER` senders
- No foreign key on `sender_id` — intentional, because it references two different tables
- `onDelete: Cascade` — deleting a conversation deletes all its messages

### assignments
- Belongs to one `conversation`
- Has two relationships to `users`:
  - `assigned_to` — the staff member receiving the conversation
  - `assigned_by` — the admin/staff who made the assignment
- `onDelete: Restrict` on users — can't delete a user who has assignments

### notifications
- Belongs to one `user`
- `reference_id` stores the ID of the related entity (e.g. conversation ID)
- `is_read` flag for marking notifications as read
- `onDelete: Cascade` — deleting a user removes their notifications

### webhook_events
- Standalone table — not directly related to other entities
- `event_id` is `UNIQUE` — enforces idempotency (same webhook can't be processed twice)
- `payload` stored as `JSONB` for flexible structure
- Status: `RECEIVED` → `PROCESSED` or `FAILED`

### attachments
- Belongs to one `message`
- Stores file metadata only — actual files stored on disk or cloud storage
- `onDelete: Cascade` — deleting a message removes its attachments

### activity_logs
- Belongs to one `conversation` and one `user`
- Append-only — never updated, only inserted
- `meta` stored as `JSONB` for flexible action details

---

## Key Design Decisions

### Why are `users` and `customers` separate tables?
Customers are external end-users. Users are internal staff with roles, passwords, and system access.
Mixing them would complicate authentication and authorization significantly.

### Why does `messages.sender_id` have no foreign key?
Because a message can be sent by either a `user` or a `customer` — two different tables.
The `sender_type` enum (`USER` | `CUSTOMER`) tells the application which table to query.
This is a standard polymorphic association pattern.

### Why use junction tables for many-to-many?
`user_roles` and `conversation_members` exist because SQL cannot directly model
many-to-many relationships. The junction table holds one row per pairing,
with a composite unique constraint to prevent duplicates.

### Why does `assignments` have two FK columns to `users`?
`assigned_to` = who receives the work. `assigned_by` = who delegated it.
Both reference `users` but represent different roles in the same action.

### Why is `webhook_events.event_id` unique?
To enforce idempotency — if the same webhook arrives twice (network retry),
the second insert will fail the unique constraint and be ignored safely.

---

## Indexes

| Table | Index | Reason |
|---|---|---|
| `conversations` | `customer_id` | Filter conversations by customer |
| `conversations` | `status` | Filter by status (OPEN, CLOSED etc.) |
| `messages` | `conversation_id` | Load all messages in a conversation |
| `assignments` | `conversation_id` | Find assignments for a conversation |
| `notifications` | `(user_id, is_read)` | Load unread notifications for a user |
| `activity_logs` | `conversation_id` | Load activity history for a conversation |
| `webhook_events` | `event_id` | Fast idempotency check on incoming webhooks |

---

## Enum Values

| Enum | Values |
|---|---|
| `ConversationStatus` | `OPEN`, `ASSIGNED`, `PENDING`, `CLOSED` |
| `SenderType` | `USER`, `CUSTOMER` |
| `WebhookStatus` | `RECEIVED`, `PROCESSED`, `FAILED` |
| `RoleName` | `ADMIN`, `STAFF`, `CUSTOMER` |
