# Property Management System

Manages 500 rental units — properties, units, tenants, leases, transactions, maintenance, and leads.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend:** Node.js + Express 5
- **ORM:** Prisma 6
- **Database:** Supabase PostgreSQL

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

Copy the example env and fill in your Supabase connection string:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your `DATABASE_URL`.

### 3. Run database migration

```bash
cd server
npx prisma migrate dev --name init
```

### 4. Start development servers

Terminal 1 — backend:
```bash
cd server && npm run dev
```

Terminal 2 — frontend:
```bash
cd client && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Prisma Studio: `cd server && npx prisma studio`
