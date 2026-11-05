# Phase 1 — Foundation Architecture

## Current scope

The initial repository establishes the Next.js application shell and the first owner-dashboard visual direction. This phase adds the first PostgreSQL data model for organization setup, branches, users, role permissions, branch assignments, and audit history.

## Core decisions

- One organization owns multiple branches.
- Every user belongs to an organization and has a role.
- Branch access is assigned explicitly through UserBranch.
- Permissions are stored as stable permission keys and assigned to roles.
- Branch codes are unique within an organization.
- User email is unique.
- Audit records retain actor, branch, entity, action, timestamp, reason, and before/after JSON snapshots.
- Financial and inventory records will be append-only or reversed through controlled compensating entries in their respective modules.

## Important implementation safeguards

- Never trust a branch ID supplied by the browser. Resolve allowed branches from the authenticated user's assignments and permissions on the server.
- Enforce permissions in server-side actions and route handlers, not only in navigation visibility.
- Use database transactions for multi-record business operations.
- Keep monetary values as PostgreSQL Decimal in later financial models.
- Do not seed production with fake sales or financial figures.
- Do not deploy until authentication, authorization, migrations, backups, and automated tests are implemented.

## Database setup

1. Copy .env.example to .env.
2. Set DATABASE_URL to a PostgreSQL database you control.
3. Run npm install.
4. Run npm run db:generate.
5. Create the first reviewed migration with npm run db:migrate.

A production database URL must never be committed to GitHub.
