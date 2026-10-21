# Current bottleneck: backend fails to build on Railway

_Opened 2026-10-21. Update this file after every attempt. When resolved, delete it, remove the Open issue line from `CLAUDE.md`, and log the fix in `CHANGELOG.md`._

## Status (updated 2026-10-21, after the second attempt)

| Service | State |
| --- | --- |
| Postgres | Online |
| backend | **Builds and runs now.** `/admin` returns 200 and Payload starts. But every route that reads the database returns 500 "Something went wrong" (`/api/categories`, `/api/media`, `/api/globals/*`, `/api/products`, `/api/variants`). |
| frontend | Online, but empty because of the above. |

The volume (`babunest-backend-volume`, mounted at `/data`) and all five variables are set.

## Diagnosis

Payload starts, but **the database tables were never created**. Railway's pre-deploy `npm run migrate` either didn't run or failed without blocking the deploy. Its log hasn't been read.

The earlier *build* failure (about 6 minutes, cause unseen) didn't recur after the variables and volume were set. It's resolved, cause unknown.

## Fix applied, waiting to deploy

- `src/payload.config.ts`: `postgresAdapter({ prodMigrations: migrations })`. Payload now applies pending migrations itself when the server starts in production, so the tables no longer depend on the pre-deploy step.
- Verified locally: a production build plus `next start` against an empty Postgres logged `Migrated: 20261020_170531_initial`, and `/api/categories`, `/api/globals/navigation` and `/api/products` all returned 200.

## Next steps

1. Push `babunest-backend`, which redeploys it.
2. Check that `https://babunest-backend-production.up.railway.app/api/categories?limit=1` returns 200 (`{"docs":[]...}`).
3. Open `/admin`, create the admin account, then redeploy the frontend.
4. If it is still 500, read the **Deploy logs** for `Migrating:` / `Migrated:` lines or a database error.
5. When it works, delete this file and the Open issue lines (both repos), and log the resolution.

## Railway variables (no secret values here)

**backend:**
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `PAYLOAD_SECRET` (set in Railway; it was shown in a screenshot on 2026-10-21, so rotate it before the first account is created)
- `PAYLOAD_PUBLIC_SERVER_URL=https://babunest-backend-production.up.railway.app`
- `STOREFRONT_URL`: should be `https://babunest-frontend-production.up.railway.app` until the domain is connected (it was `https://babunest.com`)
- `MEDIA_DIR=/data/media`

**frontend:**
- `NEXT_PUBLIC_PAYLOAD_URL=https://babunest-backend-production.up.railway.app`
- `NEXT_PUBLIC_SITE_URL=https://babunest-frontend-production.up.railway.app`

## After the backend is live

1. Add real products and set the Home Page, Navigation and Shipping Settings globals.
2. Test an order end to end on the Railway frontend URL.
3. **Custom domain**
   - Move babunest.com's DNS from Hostinger to Cloudflare.
   - Add `babunest.com` and `www` to the frontend and `api.babunest.com` to the backend.
   - Update the four URL variables and redeploy both.
4. Later: replace the placeholder email in `Frontend/src/lib/contact.ts`, and add an email adapter.
