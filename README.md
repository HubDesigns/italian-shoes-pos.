# Italian Shoes — Multi-Branch POS

A centralized retail management system for a footwear business operating multiple branches in Pakistan.

## Current foundation

- Next.js App Router + TypeScript
- Responsive Italian Shoes visual design system
- Owner dashboard shell
- Navigation structure for planned business modules
- No fabricated business metrics; dashboard values remain empty until connected to live data

## Requirements

- Node.js 20.9 or newer
- npm

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build verification

```bash
npm run build
```

## Planned architecture

- PostgreSQL database
- Prisma ORM
- Secure authentication and server-side RBAC
- Branch-aware inventory, POS, payments and accounting
- Append-only financial and stock movement history
- Audit logging and approval workflows

## Implementation status

This repository currently contains the initial UI foundation only. Authentication, database integration, business workflows, and reporting must be implemented and tested before production use.

## Business configuration

- Business: Italian Shoes
- Currency: PKR
- Date format: DD-MM-YYYY
- Timezone: Asia/Karachi
- Initial branches: 4
