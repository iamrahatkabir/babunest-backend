# Changelog — Babunest Backend

Newest first. Rules and entry format are in `CLAUDE.md`. Entries before
2026-10-20 belong to the Brownmoor project and are not carried over.

<!-- entries -->

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
