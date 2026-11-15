# Going live: database, deployment and backups

This guide is written for the person running the shop, not for programmers. Follow it top to bottom once.

## 1. What you need

| Thing | What it is | Suggested service (free tier is fine to start) |
| --- | --- | --- |
| Database | Stores every product, user and sale | Neon or Supabase (PostgreSQL) |
| Website host | Runs the app | Vercel |

## 2. Settings the app needs

Add these in your host's **Environment Variables** screen (never put them in GitHub):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | The database connection string. If the database offers a "pooled" string, use it here. |
| `DIRECT_URL` | The **direct** (non-pooled) connection string. Used only to update the database tables. |
| `AUTH_SECRET` | A long random text, at least 32 characters. Anyone who knows it can forge logins, so keep it secret. |
| `OWNER_SETUP_SECRET` | A different long random text. Needed once to create the Owner, and again if the Owner forgets the password. |

To make a random value, open <https://www.uuidgenerator.net/> twice and join the two results, or run `openssl rand -base64 36`.

## 3. How the database tables get created

The project keeps its table definitions in `prisma/migrations`. When you deploy on **Vercel**, the build runs
`npm run vercel-build`, which applies any new migrations and then builds the site. You do nothing by hand.

On another host, set the **build command** to:

```
npx prisma generate && npx prisma migrate deploy && npm run build
```

### If your database already has tables (created earlier with `db push`)

Run these two commands once, from any computer or a GitHub Codespace that has the `DATABASE_URL` and `DIRECT_URL` settings:

```
npx prisma db push
npx prisma migrate resolve --applied 20261115120000_init
```

The first brings the tables up to date; the second tells Prisma the starting migration is already in place.
After that, normal deployments work as described above.

## 4. First start

1. Open `https://YOUR-SITE/api/health`. You should see `{"ok":true}`. If you see `{"ok":false}` the site cannot reach the database; re-check `DATABASE_URL`.
2. Open the site. It shows the setup page. Enter the setup key (`OWNER_SETUP_SECRET`), your name, email and a password.
3. Sign in, create a branch, then create staff accounts (Manager, Cashier, Warehouse) from **Staff & permissions**.

## 5. If the Owner forgets the password

On the sign-in page choose **Forgot the Owner password?**. Enter the setup key and a new password.
Only someone who can read the server settings can do this. All old sessions are signed out.

## 6. Backups (do not skip this)

Your sales and stock records live only in the database. A deleted or damaged database cannot be rebuilt from the code.

- **Turn on the provider's automatic backups.** Neon keeps a history window on every plan; Supabase includes daily backups on paid plans. Check what your plan keeps and for how long.
- **Also keep your own copy once a week.** From any computer with PostgreSQL tools installed:

  ```
  pg_dump "YOUR_DIRECT_URL" --format=custom --file=italian-shoes-YYYY-MM-DD.dump
  ```

  Store the file somewhere other than the same account (for example a different cloud drive).
- **Test a restore once**, into an empty scratch database, so you know it works before you need it:

  ```
  pg_restore --no-owner --dbname="SCRATCH_DATABASE_URL" italian-shoes-YYYY-MM-DD.dump
  ```

## 7. Security notes

- The site must run behind the host's normal HTTPS proxy (Vercel does this). Sign-in lockout uses the address the proxy reports.
- After 5 wrong passwords for one email from one address, sign-in is blocked for 15 minutes. The Owner resetting a staff member's password lifts the block immediately.
- Changing or resetting a password, or suspending an account, signs that person out everywhere.
- Every sign-in, failed sign-in, password change, suspension and permission change is written to the audit log.
