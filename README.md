# FgasPortal

FgasPortal is a SaaS register for companies that manage refrigerant installations under Swedish F-gas requirements.

This branch is prepared for PostgreSQL deployment with a fresh database. It does not migrate existing SQLite data.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication via httpOnly cookies

## Current Features

- Company registration
- Invitation-based user registration
- Login/logout with JWT cookie
- Role-based access control with `ADMIN` and `MEMBER`
- Company dashboard with compliance filters
- Installation create, edit, archive, detail view
- Inspection creation and history
- CO2e and inspection interval calculations
- Leak detection interval adjustment
- CSV and PDF exports for active installations

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file:

```bash
copy .env.example .env
```

3. Set PostgreSQL environment variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
JWT_SECRET="replace-with-a-long-random-production-secret"
```

4. Apply migrations to a fresh PostgreSQL database:

```bash
npm run prisma:deploy
```

5. Generate Prisma Client:

```bash
npm run prisma:generate
```

6. Start development:

```bash
npm run dev
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string. Recommended providers: Neon, Supabase, or Railway.
- `JWT_SECRET`: Required for signing auth cookies. Use a long random value.

## Prisma Commands

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npx prisma studio
```

Use `npm run prisma:migrate` only against development PostgreSQL databases. Use `npm run prisma:deploy` for production.

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## PostgreSQL Deployment Notes

This branch uses:

- `datasource db { provider = "postgresql" }`
- Standard `PrismaClient` in `lib/db.ts` with Prisma's PostgreSQL `pg` driver adapter
- A fresh PostgreSQL baseline migration

The previous SQLite migrations are archived under `prisma/migrations_sqlite_archive` for reference only. Do not apply them to PostgreSQL.

## Vercel Deployment

Set these Vercel environment variables:

- `DATABASE_URL`
- `JWT_SECRET`

Recommended build command:

```bash
npm run prisma:generate && npm run build
```

Run migrations against the production PostgreSQL database:

```bash
npm run prisma:deploy
```

For Neon or Supabase:

- Use the PostgreSQL connection string with SSL enabled.
- Prefer a direct/non-pooled database URL for migrations if your provider gives both pooled and direct URLs.
- Use pooled runtime connections if needed for serverless scale, after verifying Prisma compatibility for the selected connection mode.

## Production Smoke Test

After deploying to Vercel and applying migrations, verify:

- Visit the production URL and confirm the landing page loads.
- Register a new company with a unique organization number.
- Log in as the created admin user.
- Create an installation and confirm it appears on the dashboard.
- Edit the installation and confirm the detail page shows the updated values.
- Add an inspection and confirm `lastInspection`, `nextInspection`, and compliance status update.
- Confirm dashboard compliance summary and filters work.
- Export CSV and PDF as an admin user.
- Invite a `MEMBER` user, accept the invitation, and log in as that user.
- Confirm the `MEMBER` user can view dashboard/detail pages but cannot create, edit, inspect, archive, or export.
- Archive the test installation and confirm it disappears from the active dashboard list.
- Confirm logout clears the session and protected pages redirect or fail cleanly.

## Auth And Cookies

Authentication uses a JWT stored in an httpOnly cookie named `auth-token`.

Cookie settings:

- `httpOnly: true`
- `secure: true` in production
- `sameSite: "lax"`
- `path: "/"`
- max age: 7 days

Logout:

```http
POST /api/auth/logout
```
