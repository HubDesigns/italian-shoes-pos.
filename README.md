# Italian Shoes — Multi-Branch POS

A centralized retail management system for a footwear business operating multiple branches in Pakistan.

## Implemented foundation

- Next.js App Router, TypeScript and PostgreSQL through Prisma
- First-time Owner setup with a one-time setup key
- Password hashing and signed HTTP-only session cookies
- Owner dashboard with live database counts (no fabricated sales figures)
- Owner-only branch creation, editing, archival and reactivation
- Audit records for branch and staff administration changes
- Staff account creation with one or more Owner-assigned branches
- Role-level module permissions, with branch administration and permission management reserved for the Owner
- Branch managers can see only active branches assigned to their account
- Responsive workspace navigation for the implemented sections

## Requirements

- Node.js 20.9 or newer
- npm
- PostgreSQL 16 or newer

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file from `.env.example` and set:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `AUTH_SECRET` (at least 32 random characters)
   - `OWNER_SETUP_SECRET` (a separate random one-time setup key)

Generate a random secret with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice and use the two different values for `AUTH_SECRET` and `OWNER_SETUP_SECRET`. Never commit `.env`.

3. Generate Prisma Client and apply migrations:

```bash
npm run db:generate
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

Open http://localhost:3000. If the database has no users, the one-time Owner setup page appears. After setup, sign in with that Owner account.

## Owner controls

- Only the Owner can create, edit, archive or reactivate branches.
- Branches are archived rather than physically deleted so historical transactions and audit references can be retained.
- The Owner can create staff accounts, assign one or more branches, and manage the Branch Manager role's module permissions.
- Branch managers are restricted to their active assigned branches. API routes enforce Owner-only actions server-side.

## Build verification

```bash
npm run lint
npm run build
```

## Not yet implemented

POS transactions, product and size variants, inventory balances, stock transfers, purchasing, cash shifts, expenses, customer/supplier ledgers, payroll and operational reports remain future development modules. The dashboard deliberately does not display invented sales or financial totals.

## Production readiness

The current Next.js dependency should be upgraded to a patched supported release, and the full dependency audit, authentication rate limiting, backup/recovery, printer support and end-to-end business tests must be completed before public deployment.

## Business configuration

- Business: Italian Shoes
- Currency: PKR
- Date format: DD-MM-YYYY
- Timezone: Asia/Karachi
- Initial branches: 4 (create the actual locations from Owner controls)
