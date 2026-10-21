# Changelog — Babunest Backend

Newest first. Rules and entry format are in `CLAUDE.md`. Entries before
2026-10-20 belong to the Brownmoor project and are not carried over.

<!-- entries -->

### 2026-10-21 · config · Live on babunest.com; document the Cloudflare setup
- **What:** `DEPLOYMENT.md` now records the live setup: Cloudflare DNS (`@` and `www` proxied, `api` DNS only), the www→root redirect rule, the live URLs and the domain variables.
- **Why:** With `api` proxied, the storefront's `/api` forwarding hit Cloudflare Error 1000 (403), which broke the cart while pages still loaded. It was fixed by switching `api` to DNS only, and that must not be undone.
- **Files:** `DEPLOYMENT.md`
- **Status:** verified live: www → 301 to root (query kept), images and the feed served from the domain, CORS allows babunest.com, and add to cart on babunest.com works (count 1, no errors). No order placed on production yet.

### 2026-10-21 · config · Railway deploy unblocked: backend live with its tables
- **What:** Deleted `CURRENT-BOTTLENECK.md` and the Open issue line in `CLAUDE.md`. The backend at https://babunest-backend-production.up.railway.app is live.
- **Why:** Resolved by `prodMigrations` (previous entry): the deploy applied `20261020_170531_initial` on start. The earlier 6-minute build failure didn't recur after the variables and the `/data` volume were set, so its cause is still unknown.
- **Files:** `CURRENT-BOTTLENECK.md` (deleted), `CLAUDE.md`
- **Status:** verified on Railway: categories, navigation, products, home-page and shipping-settings all return 200. The admin account isn't created yet, and no order has been tested on Railway.

### 2026-10-21 · config · Run database migrations on server start in production
- **What:** `postgresAdapter` now has `prodMigrations: migrations`, so Payload applies pending migrations itself when it starts in production, alongside Railway's pre-deploy `npm run migrate`.
- **Why:** On Railway, Payload started but every read returned 500 because no tables existed. The pre-deploy migration hadn't run or had failed quietly.
- **Files:** `src/payload.config.ts`, `CODEMAP.md`, `CURRENT-BOTTLENECK.md`
- **Status:** verified locally with a production build and `next start` on an empty Postgres: it logged `Migrated: 20261020_170531_initial`, and categories, navigation and products returned 200. Not yet deployed.

### 2026-10-21 · docs · Rule for keeping CURRENT-BOTTLENECK.md current
- **What:** `CLAUDE.md` now says how to handle blockers: record them in `CURRENT-BOTTLENECK.md`, update it after every attempt, and delete it (and its pointer line) once resolved.
- **Why:** The brand owner wants that file to always reflect the real state, never a stale or already-fixed problem.
- **Files:** `CLAUDE.md`, `CURRENT-BOTTLENECK.md`
- **Status:** documentation only.

### 2026-10-21 · docs · Record the Railway build failure in CURRENT-BOTTLENECK.md
- **What:** Added `CURRENT-BOTTLENECK.md`, covering the failed Railway backend build, what's known, likely causes, next steps, the Railway variables (no secrets) and the post-launch tasks. `CLAUDE.md` now points to it.
- **Why:** The build log couldn't be read today. This keeps the state so the work can pick up later without re-investigating.
- **Files:** `CURRENT-BOTTLENECK.md`, `CLAUDE.md`
- **Status:** documentation only. The backend is still not deployed.

### 2026-10-21 · deps · Force npm on Railway and pin Payload plugin versions
- **What:** `packageManager` is now `npm@10.8.2` and `@payloadcms/plugin-ecommerce` is pinned to exactly 3.88.0 (was ^3.88.0). Removed `engines.pnpm`, the `pnpm` config block and the unused `.yarnrc`.
- **Why:** The first Railway build picked pnpm (from `engines.pnpm`), ignored `package-lock.json` and installed plugin-ecommerce 3.91.0 against payload 3.88.0. The build failed with "Export uploadRequiresServerValidation doesn't exist".
- **Files:** `package.json`, `package-lock.json`, `.yarnrc` (deleted), `CODEMAP.md`
- **Status:** the backend `npm run build` passes locally. Not yet confirmed on Railway.

### 2026-10-21 · docs · Rename the brand from Brownmoor.com to BabuNest.com
- **What:** Every visible "Brownmoor.com" / "Brownmoor" is now "BabuNest.com" / "BabuNest".
- **Why:** The shop is relaunching as BabuNest.
- **Files:** `src/app/(frontend)/layout.tsx`, `src/seed/run.ts`, `src/seed/clear.ts`, `README.md`, `CODEMAP.md`
- **Status:** verified: `tsc` passes. Demo media already in the local DB keeps its old placeholder text until re-seeded.

### 2026-10-20 · config · Prepare the backend for Railway hosting
- **What:** Removed Vercel Blob; images now go to `MEDIA_DIR` (a Railway volume). Added `railway.json` with a pre-deploy `npm run migrate`, the first migration (`20261020_170531_initial`), and a Railway `DEPLOYMENT.md`. Deleted the broken `Dockerfile`, and renamed the docker-compose DB to `babunest_dev`.
- **Why:** Railway is hosting the app and database in one project. A Dockerfile in the repo would override Railway's own builder, and this one did not build.
- **Files:** `src/payload.config.ts`, `src/collections/Media.ts`, `src/app/(payload)/admin/importMap.js`, `src/migrations/*`, `railway.json`, `package.json`, `package-lock.json`, `.env.example`, `Dockerfile` (deleted), `docker-compose.yml`, `DEPLOYMENT.md`, `README.md`, `CODEMAP.md`
- **Status:** `tsc` and `npm run build` pass locally. Not yet deployed. The migration has not been run against a real database.

### 2026-10-20 · docs · Set up guidelines, code map and changelog for the fresh start
- **What:** Rewrote `CLAUDE.md` as short rules (read the map, log every change, keep replies to the user short) and added `CODEMAP.md`, a map of the current code. Restarted this changelog in a compact format.
- **Why:** So AI sessions read one map and the latest entries instead of re-reading the source each time, which saves tokens.
- **Files:** `CLAUDE.md`, `CODEMAP.md`, `CHANGELOG.md`
- **Status:** The map was written from a full read of the code on 2026-10-20. It is not checked by any tool and stays correct only if each change updates it.
