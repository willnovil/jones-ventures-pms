# Jones Ventures PMS — Claude Notes

## Stack
- `server/` — Express 5 + Prisma 6 (PostgreSQL via Supabase, see `server/.env`)
- `client/` — Vite 6 + React 19 + Tailwind 4 + react-router 7
- Server dev: `npm run dev` in `server/` → `node --watch index.js` on port 3001
- Client dev: `npm run dev` in `client/` → vite on port 5173, proxies `/api` to 3001

## Prisma + Windows: stop the dev server before any schema operation

On Windows, `node --watch` (the dev server) loads `node_modules/.prisma/client/query_engine-windows.dll.node` and Windows locks the file. Running `prisma generate`, `prisma migrate dev`, or `prisma db push` while the server is running will fail with `EPERM` because it can't overwrite the locked DLL.

**Rule:** before running any `prisma` command, stop the `npm run dev` process in `server/`. Start it again afterwards.

If you find yourself needing to kill a stale node process, **never blindly `taskkill //F //IM node.exe`** — that will kill Claude Code itself (Claude runs as a node process). Identify the specific PID with `wmic process where "ProcessId=<pid>" get CommandLine` and only kill the one running `index.js`.

`server/package.json` has `postinstall: prisma generate` so a fresh `npm install` regenerates the client cleanly. There's also `npm run dev:safe` which does `prisma generate && node --watch index.js` in one shot — use it after pulling schema changes from main.

## Lease document workflow

Lease documents are generated from a user-uploaded `.docx` template stored at `server/storage/templates/lease-template.docx` (gitignored). The template uses docxtemplater's `{tag}` placeholder syntax — the full set of supported tags lives in `PLACEHOLDERS` in `server/lib/leaseDocx.js` and is also displayed on the in-app **Templates** page (`client/src/pages/Templates.jsx`).

Flow:
1. User uploads `.docx` → `POST /api/templates/lease` (multer, in-memory) → written to `server/storage/templates/`
2. User clicks Generate Document on a lease → `POST /api/leases/:id/generate` → reads template, fills via `renderLeaseDocx`, writes per-lease docx to `server/storage/leases/{id}.docx`, runs mammoth → stores HTML preview in `Lease.leaseHtml`, sets `Lease.documentUrl` to `/api/leases/{id}/document`
3. User clicks Download DOCX → `GET /api/leases/:id/document` streams the filled docx

Per-lease docx files are gitignored (whole `server/storage/` tree). The `Lease.leaseHtml` field in the DB is the source of truth for the in-app preview only — the `.docx` on disk is the source of truth for the actual signed document.

## Lease workflow states

`LeaseStatus` in `server/prisma/schema.prisma`: `DRAFT → PENDING_REVIEW → APPROVED → SENT → ACTIVE` (plus `EXPIRED`, `TERMINATED`). Each transition has its own POST endpoint in `server/routes/leases.js` (`/generate`, `/review`, `/approve`, `/send`, `/sign`) and stamps a corresponding timestamp field on the Lease. The `/sign` endpoint also flips the related Unit to `OCCUPIED`, mirroring the auto-status sync in `PUT /:id`.
