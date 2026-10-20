# Changelog

Every change made to this repository, newest first.

The rules for writing an entry — when one is needed and what it should say —
are in [CLAUDE.md](CLAUDE.md).

## 2026-10-20 — Split the monorepo into separate frontend and backend repositories

**What changed:** This app now lives in its own repository, with the app at the
repository root instead of under `Backend/`. The storefront and backend are in
`babunest-frontend` and `babunest-backend`, both public on GitHub under
`iamrahatkabir`. The old `brownmoor-ecom` remote was disconnected, and each new
repository starts from one fresh commit. The repo-wide `CLAUDE.md` rules,
`DEPLOYMENT.md` and this changelog were copied into both repositories.
`DEPLOYMENT.md` now names the new repositories and leaves Vercel's Root
Directory at its default. `.gitignore` now also ignores every `.env.*` file except `.env.example`, which the old root `.gitignore` used to cover.

**Why:** We wanted each app versioned and deployed on its own, as Babunest
rather than Brownmoor.

**Files:** `CLAUDE.md`, `CHANGELOG.md`, `DEPLOYMENT.md`, `.gitignore`

**Not carried over:** The 76 commits of history from `brownmoor-ecom`. They
still exist on that GitHub repository and in the old local `.git`. Entries
below this one refer to monorepo paths such as `Backend/src/...`, which are now
`src/...`. Existing Vercel projects still point at `brownmoor-ecom` and have to
be re-linked by hand. App code still uses the Brownmoor name in places.

## 2026-09-20 - Add a Meta product feed at /feed/meta.xml

**What changed:** The storefront now publishes an RSS 2.0 product feed for the
Meta (Facebook / Instagram) catalogue at `/feed/meta.xml`. A product with
variants emits one item per variant sharing an `item_group_id`, so Meta shows a
single listing with a size picker rather than near-duplicate entries bidding
against each other. Out-of-stock items are published as `out of stock` rather
than dropped, since an item's absence tells Meta to stop advertising it. Added
`NEXT_PUBLIC_SITE_URL` (the storefront's own origin, needed for absolute links)
and a `Frontend/.env.example` documenting the storefront's variables.

**Why:** Running Facebook and Instagram shop ads needs a catalogue, and keeping
one in sync by hand does not survive a price change. Generating it from Payload
means the feed is correct by construction.

**Files:** `Frontend/src/lib/feed.ts`, `Frontend/src/app/feed/meta.xml/route.ts`,
`Frontend/.env.example`, `Frontend/.gitignore`, `.claude/launch.json`,
`DEPLOYMENT.md`

**Also fixed in passing:** `Frontend/.gitignore` matched `.env*` with no
exception, which would have silently ignored the new `.env.example`. Added a
`!.env.example` negation, matching how `Backend/` already does it and what the
root `.gitignore` says the policy is.

**Verified:** Fetched against the local backend — 79 items across 10 variant
groups, well-formed per `xmllint`, no duplicate IDs, every Meta-required field
present, and sale prices correctly below their regular price.

**Not verified:** The feed has not been ingested by Meta itself, so their
validator may still object to something this check cannot see.

**Also updated:** `DEPLOYMENT.md` listed only one storefront environment
variable, so following it would have deployed a feed whose every link pointed
at localhost. Added `NEXT_PUBLIC_SITE_URL` to the storefront table, to the
custom-domain step, and a section on wiring the feed into Commerce Manager.

**Outstanding:** `NEXT_PUBLIC_SITE_URL` must be set in the storefront's Vercel
environment. Unset, it falls back to `http://localhost:3001` and every product
link in the feed points at a machine Meta cannot reach. Product images are
served from `NEXT_PUBLIC_PAYLOAD_URL`, which must also be publicly reachable.
Feed items link to the product page rather than a specific variant, because the
storefront holds variant choice in client state with no URL parameter to target.

## 2026-09-20 — Start recording changes in a changelog

**What changed:** Added `CLAUDE.md` at the repo root, carrying a standing rule
that any change to the repository must be recorded here, along with the format
an entry takes. Added this changelog as the place those entries go.

**Why:** The repo's history was only legible through `git log`, whose messages
run to "bug fix" and "Slider". Neither says what actually changed or why it was
needed, which makes it slow to work out what state the shop is in. The rule
lives in `CLAUDE.md` specifically because that file is loaded automatically at
the start of every Claude Code session — an instruction file under any other
name would sit unread.

**Files:** `CLAUDE.md`, `CHANGELOG.md`

*No application code was changed.*
