# Current bottleneck: backend fails to build on Railway

_Opened 2026-10-21. Update this file after every attempt. When resolved, delete it, remove the Open issue line from `CLAUDE.md`, and log the fix in `CHANGELOG.md`._

## Status

| Service | Railway URL | State |
| --- | --- | --- |
| Postgres | (private) | Online |
| backend (`babunest-backend`) | https://babunest-backend-production.up.railway.app | **Latest build failed.** The old deployment is still live and returns 500 "There was an error initializing Payload" on every route. |
| frontend | https://babunest-frontend-production.up.railway.app | Online. Pages load but show no products, because the backend is down. |

## Symptom

The latest backend deployment fails at **Build › Build image**: "Failed to build an image. Please check the build logs for more details." The build ran about 5m46s before failing.

The build log itself has **not been read yet**. Railway's AI diagnosis was unavailable ("Agent usage limit reached"). That message only concerns Railway's helper, not the plan or the deploy.

## What is already known

1. **First failure, fixed:** Railway picked pnpm (from `engines.pnpm`), ignored `package-lock.json` and installed `@payloadcms/plugin-ecommerce` 3.91.0 against `payload` 3.88.0. The build failed with "Export uploadRequiresServerValidation doesn't exist".
   - Fixed in commit `35f2deb`: `packageManager: npm@10.8.2`, plugin pinned to 3.88.0, pnpm hints and `.yarnrc` removed.
2. **The 500 on the live deployment** comes from the earlier deploy, which ran with **no variables saved**. Railway's "Suggested Variables" panel showed values from `.env.example`, which are not saved until **Add** is clicked. After that, the variables were set and a new deploy was started, and that is the build that fails.
3. **The code builds.** A clean `git archive` copy of `HEAD` with `npx npm@10.8.2 ci` and `npm run build` succeeds locally (macOS, 2026-10-21). So the failure is specific to Railway's build environment.

## Likely causes, most likely first

1. **Memory or time on the builder.** `npm run build` sets `--max-old-space-size=8000` (8 GB heap). If the builder has less memory, the build is killed. The ~6-minute run, against ~2 minutes for the first build, points this way.
   - Fix: lower it to `--max-old-space-size=4096` in `package.json` > `scripts.build`, or remove it.
2. **The `packageManager: npm@10.8.2` field** makes Railpack fetch that exact npm through corepack or mise. If that step fails or hangs, the build fails.
   - Fix: remove `packageManager` and rely on `package-lock.json` alone, now that the pnpm hints are gone.
3. **Something only the log shows**, such as a missing Linux binary (sharp, `@next/swc-linux-x64-gnu`).

## Next steps

1. Open the failed deployment → **Build logs** → scroll to the bottom → copy the last 15–20 lines.
2. Match them to a cause above and apply that fix in `package.json`. Then run `npm install` (keep the lockfile in sync), `npm run build` locally, commit, log it in `CHANGELOG.md`, and push.
3. When the deploy is green, check that `https://babunest-backend-production.up.railway.app/admin` shows **Create first user**. Create the admin account.
   - If it still shows 500, read the **pre-deploy** log (migration `20261020_170531_initial`) and **deploy** log. Check that `DATABASE_URL` resolves to a real `postgresql://` URL and that `PAYLOAD_SECRET` is set.

## Railway variables (no secret values here)

**backend:**
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` (the reference, not the `.env.example` placeholder)
- `PAYLOAD_SECRET` (set in Railway; never commit it)
- `PAYLOAD_PUBLIC_SERVER_URL=https://babunest-backend-production.up.railway.app`
- `STOREFRONT_URL=https://babunest-frontend-production.up.railway.app` (switch to `https://babunest.com` once the domain is connected)
- `MEDIA_DIR=/data/media`, with a volume mounted at `/data`

**frontend:**
- `NEXT_PUBLIC_PAYLOAD_URL=https://babunest-backend-production.up.railway.app`
- `NEXT_PUBLIC_SITE_URL=https://babunest-frontend-production.up.railway.app`

## After the backend is live

1. Add real products and set the Home Page, Navigation and Shipping Settings globals in the admin.
2. Test an order end to end on the Railway frontend URL.
3. **Custom domain**
   - Move babunest.com's DNS from Hostinger to Cloudflare (free), because Hostinger can't point the root domain at Railway.
   - Add `babunest.com` (and `www`) to the frontend and `api.babunest.com` to the backend.
   - Update the four URL variables above, then redeploy both.
4. Later: replace the placeholder email `hellobrownmoor@gmail.com` in `Frontend/src/lib/contact.ts`, and add an email adapter for order emails and password resets.
