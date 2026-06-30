# CRM Backend — VietProDev Node.js Challenge

A Realtime CRM / Customer Support backend built with Node.js and TypeScript, covering Challenges 0–12.

---

## Project Introduction

This project is a backend system for a Realtime CRM / Customer Support platform. It allows internal staff (ADMIN, STAFF) to manage customers, handle support conversations in real time, receive notifications, upload file attachments, and process background jobs. Built as part of the VietProDev Node.js Backend Internship Challenge series.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Framework | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT |
| Realtime | Socket.IO |
| Queue | BullMQ + Upstash Redis |
| File Storage | Cloudinary |
| API Docs | Swagger / OpenAPI |
| Containerization | Docker + docker-compose |

---

## Project Structure

```
src/
├── auth/                     # JWT auth, guards, decorators
│   ├── decorators/           # @Roles()
│   ├── dto/                  # RegisterDto, LoginDto
│   ├── guards/               # JwtAuthGuard, RolesGuard
│   └── strategies/           # JwtStrategy
├── attachments/              # File upload & retrieval (Cloudinary)
├── chat/                     # Socket.IO WebSocket gateway
├── common/
│   ├── filters/              # GlobalExceptionFilter
│   ├── interceptors/         # ResponseInterceptor
│   └── utils/                # File upload utils
├── conversations/            # Conversation & message logic
├── customers/                # Customer management
├── health/                   # GET /api/health
├── messages/                 # Message search API
├── notifications/            # Notification management
├── prisma/                   # PrismaService (global)
├── queue/                    # BullMQ producer & consumer
├── users/                    # User listing
├── webhooks/                 # Webhook receive & event log
└── main.ts                   # Bootstrap: Swagger, pipes, guards
```

---

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or via Docker)
- Redis / Upstash Redis (required for queue — Challenge 10+)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, REDIS_URL, Cloudinary credentials

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed sample data (optional)
npx prisma db seed

# 5. Start in development mode
npm run start:dev
```

App will be available at `http://localhost:3000`.

### Known Issue — Node.js v24 Incompatibility

NestJS CLI is incompatible with Node.js v24. Use this workaround:

```bash
npx tsc -p tsconfig.build.json && node dist/main.js
```

Permanent fix: downgrade to Node.js 20 LTS via nvm.

---

## Running with Docker

### Prerequisites

- Docker Desktop installed and running

### Setup

```bash
# 1. Copy Docker environment file and fill in real values
cp .env.example .env.docker
# Edit .env.docker — set DATABASE_URL, REDIS_URL, JWT_SECRET, Cloudinary credentials

# 2. Build and start all containers
docker compose up --build

# 3. App will be available at:
#    API:     http://localhost:3000/api
#    Swagger: http://localhost:3000/api/docs
```

### Services

| Service | Port |
|---|---|
| app (NestJS) | 3000 |
| db (PostgreSQL) | 5432 |
| redis | 6379 |

### Stop containers

```bash
# Stop without deleting data
docker compose down

# Stop and delete volumes (wipes database)
docker compose down -v
```

### Notes

- Database migrations run automatically on container start via `docker-entrypoint.sh`
- `.env.docker` is excluded from git — never commit real credentials
- Inside Docker, services communicate via service names (`db`, `redis`) not `localhost`

---

## Environment Variables

```env
# App
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/crm_db

# Auth
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Queue (Challenge 10+)
REDIS_URL=rediss://your-upstash-url:6379
REDIS_HOST=your-upstash-host
REDIS_PORT=6379
REDIS_TOKEN=your-upstash-token
REDIS_TLS=true

# Cloudinary (Challenge 8+)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

For Docker, use `.env.docker` with service names instead of `localhost`:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/crm_db
REDIS_URL=redis://redis:6379
REDIS_TLS=false
```

---

## API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` after starting the app.

To authenticate in Swagger:
1. Call `POST /api/auth/login` and copy the `accessToken`
2. Click **Authorize** in Swagger UI
3. Enter `Bearer <accessToken>`

### Endpoint Summary

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | /api/health | Health check | Public |
| POST | /api/auth/register | Register new user | ADMIN only |
| POST | /api/auth/login | Login and get JWT token | Public |
| GET | /api/auth/profile | Get current user profile | JWT |
| POST | /api/customers | Create a new customer | ADMIN only |
| GET | /api/customers | Get all customers | ADMIN / STAFF (assigned only) |
| GET | /api/customers/:id | Get customer by ID | ADMIN / STAFF (assigned only) |
| PUT | /api/customers/:id | Update customer | ADMIN only |
| DELETE | /api/customers/:id | Delete customer | ADMIN only |
| GET | /api/users | Get all users | JWT |
| GET | /api/users/:id | Get user by ID | JWT |
| POST | /api/conversations | Create a conversation | ADMIN / STAFF |
| GET | /api/conversations | Get conversations | ADMIN sees all / STAFF+CUSTOMER sees own |
| GET | /api/conversations/:id | Get one conversation | ADMIN / member only |
| POST | /api/conversations/:id/messages | Send a message | JWT + member |
| GET | /api/conversations/:id/messages | Get message history | JWT + member |
| POST | /api/conversations/:id/pending | Set conversation to pending | JWT |
| POST | /api/conversations/:id/assign | Assign to staff | ADMIN / STAFF |
| POST | /api/conversations/:id/unassign | Unassign | ADMIN / STAFF |
| POST | /api/conversations/:id/close | Close conversation | ADMIN / STAFF |
| POST | /api/conversations/:id/reopen | Reopen conversation | ADMIN / STAFF |
| POST | /api/conversations/:id/messages/with-attachment | Send message with file | JWT + member |
| GET | /api/attachments/:id | Get attachment metadata | JWT + member |
| GET | /api/notifications | Get my notifications | JWT |
| POST | /api/notifications/:id/read | Mark notification as read | JWT |
| POST | /api/webhooks/messages | Receive webhook event | Public |
| GET | /api/webhooks/events | Get all webhook events | ADMIN only |
| GET | /api/messages | Search messages with pagination | JWT |

---



## Response Format

All responses follow this unified shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "errors": null
}
```

---

## Auth Flow

JWT-based authentication introduced in Challenge 3.

```
POST /api/auth/register   → create account
POST /api/auth/login      → returns { accessToken: "eyJ..." }
GET  /api/auth/profile    → requires valid Bearer token
```

Tokens are verified by `JwtAuthGuard`. Role-based access is enforced by `RolesGuard` using the `@Roles()` decorator.

**Roles:**

| Role | Permissions |
|---|---|
| `ADMIN` | Full access — manages users, customers, conversations, webhooks |
| `STAFF` | Handles assigned conversations, sends messages |
| `CUSTOMER` | Views and sends messages in own conversations |

---

## Conversation / Message Flow

```
1. ADMIN/STAFF creates conversation
   POST /api/conversations
   → status: OPEN

2. ADMIN/STAFF assigns to a staff member
   POST /api/conversations/:id/assign
   → status: ASSIGNED

3. Staff sends messages
   POST /api/conversations/:id/messages

4. Staff closes conversation
   POST /api/conversations/:id/close
   → status: CLOSED

5. Can reopen
   POST /api/conversations/:id/reopen
   → status: OPEN
```

Valid status transitions: `OPEN → ASSIGNED → CLOSED → OPEN (reopen)`

---

## Realtime WebSocket Flow

Socket.IO gateway introduced in Challenge 5.

```
1. Client connects with JWT token:
   io("http://localhost:3000", { auth: { token: "eyJ..." } })

2. Server validates token in handleConnection()
   → attaches user to socket
   → rejects connection if token invalid

3. Client joins a conversation room:
   socket.emit("joinRoom", { conversationId: "uuid" })

4. Client sends a message:
   socket.emit("sendMessage", { conversationId, content })

5. Server saves message to DB and broadcasts to room:
   socket.to(conversationId).emit("newMessage", message)
```

Token can be passed via `auth.token` or `query.token` for Postman compatibility.

---

## File Upload Flow

Introduced in Challenge 8. Files are stored on Cloudinary.

```
POST /api/conversations/:id/messages/with-attachment
  Content-Type: multipart/form-data
  Body: { file: <binary>, content: "optional message text" }

→ Validates file type: jpg, png, pdf, docx only
→ Validates file size: max 5MB
→ Uploads file to Cloudinary
→ DB transaction: creates Message, then Attachment with messageId
→ Returns message + attachment with Cloudinary URL
```

Only conversation members can access attachments. Cloudinary URLs provide access-controlled file delivery without exposing local paths.

---

## Queue / Background Job Flow

BullMQ + Redis used for background notification jobs. Introduced in Challenge 10.

```
1. User sends message → POST /api/conversations/:id/messages
2. ConversationsService saves message to DB
3. NotificationProducer adds job to BullMQ queue
   → HTTP response returns immediately (non-blocking)
4. NotificationConsumer picks up job in background:
   a. Finds all conversation members except the sender
   b. Creates Notification records in DB (skipDuplicates: true)
   c. Logs job status: active / completed / failed
5. If job fails → retries up to 3 times with exponential backoff
```

Jobs are deduplicated by `jobId: notification_<messageId>` to prevent duplicate notifications on retry.

---

## Webhook / Notification Handling

Introduced in Challenge 7.

```
POST /api/webhooks/messages  (public — no JWT required)
  → Validates payload structure
  → Checks eventId for idempotency (skips duplicate events)
  → Saves WebhookEvent to DB with status PROCESSED

GET /api/webhooks/events  (ADMIN only)
  → Returns all stored webhook events for debugging
```

```
GET  /api/notifications            → user sees own notifications only
POST /api/notifications/:id/read   → marks notification as read
```

---

## Role-Based Access Control

| Endpoint | ADMIN | STAFF | CUSTOMER |
|---|---|---|---|
| Register user | ✅ | ❌ | ❌ |
| Create customer | ✅ | ❌ | ❌ |
| View all customers | ✅ | assigned only | ❌ |
| Create conversation | ✅ | ✅ | ❌ |
| View conversations | all | member only | member only |
| Assign / close conversation | ✅ | ✅ | ❌ |
| View webhook events | ✅ | ❌ | ❌ |

---

## Rate Limiting

| Endpoint | Limit |
|---|---|
| POST /api/auth/login | 5 requests / 60s |
| POST /api/auth/register | 3 requests / 60s |
| POST /api/webhooks/messages | 30 requests / 60s |
| All other endpoints | 100 requests / 60s (global default) |

---

## Database Design

See `docs/database_analysis.md` for full ERD and table descriptions.

**Entities:** `users`, `roles`, `user_roles`, `customers`, `conversations`, `conversation_members`, `messages`, `assignments`, `notifications`, `webhook_events`, `attachments`, `activity_logs`

Key constraints:
- `@@unique([userId, referenceId])` on `notifications` — prevents duplicate notifications on job retry
- `eventId` unique on `webhook_events` — enforces idempotency
- Soft-delete pattern on `assignments` via `unassignedAt` nullable field

---

## Security Notes

- Passwords are hashed with bcrypt — never stored in plain text
- JWT tokens are never logged
- Passwords are never logged
- `passwordHash` is excluded from all API responses via Prisma `select`
- File access is gated by conversation membership check
- Webhook events endpoint is ADMIN-only to prevent data leakage
- Rate limiting protects auth and webhook endpoints from brute-force and abuse
- In production: use signed Cloudinary URLs instead of public URLs to prevent unauthorized file access
- Local Redis in Docker has no auth — acceptable for development; add `requirepass` for production
- `userRoles?.[0]` reads only the first role — safe for current data model (one role per user), fragile if multi-role support is added later