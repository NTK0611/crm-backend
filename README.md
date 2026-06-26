# CRM Backend — VietProDev Node.js Challenge

A Realtime CRM / Customer Support backend built with Node.js and TypeScript.

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
| API Docs | Swagger / OpenAPI |
| Containerization | Docker + docker-compose (Challenge 12) |

---

## Project Structure

```
src/
├── auth/                     # JWT auth, guards, decorators
│   ├── decorators/           # @Roles()
│   ├── dto/                  # RegisterDto, LoginDto
│   ├── guards/               # JwtAuthGuard, RolesGuard
│   └── strategies/           # JwtStrategy
├── attachments/              # File upload & retrieval
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
- Redis / Upstash Redis (required for Challenge 10+ queue)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, REDIS_URL

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed sample data (optional)
npx prisma db seed

# 5. Start in development mode
npm run start:dev
```

### Known Issue — Node.js v24 Incompatibility

NestJS CLI is incompatible with Node.js v24. Use this workaround to run the app:

```bash
npx tsc -p tsconfig.build.json && node dist/main.js
```

Permanent fix: downgrade to Node.js 20 LTS via nvm.

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
PORT=3000

# Queue (Challenge 10+)
REDIS_URL=rediss://your-upstash-url:6379
REDIS_TOKEN=your-upstash-token
```

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
POST /api/auth/login
  → returns { accessToken: "eyJ..." }

GET /api/protected-endpoint
  → Authorization: Bearer <accessToken>
```

Tokens are verified by `JwtAuthGuard`. Role-based access is enforced by `RolesGuard` using the `@Roles()` decorator.

**Roles:**
- `ADMIN` — full access, manages users, customers, conversations
- `STAFF` — handles assigned conversations, sends messages
- `CUSTOMER` — views and sends messages in own conversations

---

## Conversation / Message Flow

```
1. ADMIN/STAFF creates conversation → POST /conversations
2. Conversation starts with status: OPEN
3. ADMIN/STAFF assigns to staff → POST /conversations/:id/assign
   → status: ASSIGNED
4. Staff sends messages → POST /conversations/:id/messages
5. Staff closes conversation → POST /conversations/:id/close
   → status: CLOSED
6. Can reopen → POST /conversations/:id/reopen
   → status: OPEN
```

---

## Realtime WebSocket Flow

Socket.IO gateway introduced in Challenge 5.

```
1. Client connects with JWT token:
   io("http://localhost:3000", { auth: { token: "eyJ..." } })

2. Server validates token in handleConnection()
   → attaches user to socket

3. Client joins a conversation room:
   socket.emit("joinRoom", { conversationId: "uuid" })

4. Client sends message:
   socket.emit("sendMessage", { conversationId, content })

5. Server saves message to DB and broadcasts to room:
   socket.to(conversationId).emit("newMessage", message)
```

Token can be passed via `auth.token` or `query.token` for Postman compatibility.

---

## File Upload Flow (Challenge 8)

```
POST /api/conversations/:id/messages/with-attachment
  Content-Type: multipart/form-data
  Body: { file: <binary>, content: "message text" }

→ Server validates file type (jpg, png, pdf, docx) and size (max 5MB)
→ $transaction: creates Message first, then Attachment with messageId
→ Returns message + attachment with full file URL
```

Files are stored locally in `/uploads/`. In production, use Cloudinary or S3 with signed URLs to enforce access control.

---

## Queue / Background Job Flow (Challenge 10)

BullMQ + Upstash Redis used for background notification jobs.

```
1. User sends message → POST /conversations/:id/messages
2. ConversationsService saves message to DB
3. NotificationProducer.dispatchSendNotification() adds job to queue
   → HTTP response returns immediately (non-blocking)
4. NotificationConsumer.process() picks up job in background:
   a. Finds all conversation members except sender
   b. Creates Notification records in DB for each member
   c. Logs job status (active / completed / failed)
5. If job fails → retry up to 3 times with exponential backoff
```



---

## Webhook / Notification Handling (Challenge 7)

```
POST /api/webhooks/messages  (public — no JWT required)
  → Validates payload
  → Checks eventId idempotency (skips duplicate events)
  → Saves WebhookEvent to DB with status PROCESSED

GET /api/webhooks/events  (ADMIN only)
  → Returns all stored webhook events for debugging
```

---

## Role-Based Access Control (Challenge 11)

| Endpoint | ADMIN | STAFF | CUSTOMER |
|---|---|---|---|
| Register user | ✅ | ❌ | ❌ |
| Create customer | ✅ | ❌ | ❌ |
| View all customers | ✅ | assigned only | ❌ |
| Create conversation | ✅ | ✅ | ❌ |
| View conversations | all | member only | member only |
| Assign/close conversation | ✅ | ✅ | ❌ |
| View webhook events | ✅ | ❌ | ❌ |

---

## Rate Limiting (Challenge 11)

| Endpoint | Limit |
|---|---|
| POST /auth/login | 5 requests / 60s |
| POST /auth/register | 3 requests / 60s |
| POST /webhooks/messages | 30 requests / 60s |
| All other endpoints | 100 requests / 60s (global default) |

Rate limit headers are included in every response:
- `x-ratelimit-limit` — max requests allowed
- `x-ratelimit-remaining` — requests remaining in window
- `x-ratelimit-reset` — seconds until window resets

---

## Security Notes

- Passwords are hashed with bcrypt — never stored in plain text
- JWT tokens are never logged
- Passwords are never logged
- `passwordHash` is excluded from all API responses via Prisma `select`
- File access is checked against conversation membership
- Webhook events endpoint is ADMIN-only to prevent data leakage
- Rate limiting protects auth endpoints from brute-force attacks
- In production: use signed URLs (Cloudinary/S3) instead of local file serving to prevent direct file access bypass

---

## Database Design

See `docs/database_analysis.md` for full ERD and table descriptions.

**Entities:** users, roles, user_roles, customers, conversations, conversation_members, messages, assignments, notifications, webhook_events, attachments, activity_logs