# GATEFLOW

Personal GATE 2027 study tracker. Phase 1 covers project setup only.

## Stack

- Client: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui
- Server: Express, TypeScript, REST
- Database: PostgreSQL + Prisma

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Create the `gateflow` database in PostgreSQL.
3. Install dependencies: `npm install`
4. Run migrations: `npm run db:migrate`
5. Start both apps: `npm run dev`

Client: http://localhost:3000  
API health: http://localhost:4000/api/health
