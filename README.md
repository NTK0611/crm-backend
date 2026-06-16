# CRM Backend — VietProDev Node.js Challenge

A Realtime CRM / Customer Support backend built with Node.js and TypeScript.

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Framework | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (challenge 3+) |
| Realtime | Socket.IO (challenge 5+) |
| Queue | BullMQ + Redis (challenge 10+) |
| API docs | Swagger / OpenAPI |
| Containerization | Docker + docker-compose (challenge 12) |

## Project structure

```
src/
├── common/
│   ├── filters/          
│   └── interceptors/     # Response shape interceptor
├── health/               # GET /api/health
├── prisma/               # PrismaService (global)
└── main.ts               # Bootstrap: Swagger, pipes, guards
```

## Running locally

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or via Docker)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env — set DATABASE_URL to your Postgres instance

# 3. Run database migrations (from challenge 1 onward)
npx prisma migrate dev

# 4. Start in development mode
npm run start:dev
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/docs | Swagger UI |

## Response format

All responses follow this unified shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "errors": null
}
```

## Auth flow

JWT-based auth is introduced in Challenge 3. Protected endpoints require:

```
Authorization: Bearer <token>
```

## Database design

See docs/database_analysis.md (added in Challenge 1).
