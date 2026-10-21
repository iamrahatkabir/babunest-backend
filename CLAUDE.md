@AGENTS.md

# Babunest — Backend

Payload 3 admin panel + REST/GraphQL API on Next.js 16, Postgres. Its sister repo `babunest-frontend` is the storefront.

**Open issue:** the Railway deploy is blocked. Read `CURRENT-BOTTLENECK.md` first, and remove this line when that file is deleted.

## Answering the user

Keep replies short: the result, plus anything they must know or do. No recaps
of steps taken, no restating the question, no option surveys. Expand only
when asked.

## Before a task: read the map, not the code

1. **`CODEMAP.md`** describes the code as it is now: files, data model, routes,
   business rules, env vars and gotchas. Use it to find the exact files the task
   needs, then open only those.
2. **`CHANGELOG.md`**: read only the newest ~10 entries, or grep for the area
   (`grep -n "· checkout ·" CHANGELOG.md`). Never read the whole file.

Open source files only when you are about to edit them, or when the map does
not answer the question. If the map turns out to be wrong, fix it.

## After a change: update both files in the same turn

1. **`CHANGELOG.md`**: add one entry in the format below.
2. **`CODEMAP.md`**: rewrite any line the change made untrue, such as a new or
   removed file, field, route, rule, env var or gotcha, and bump `Last verified`.
   If nothing structural changed, leave it alone.

This is not optional and needs no permission. It is part of finishing the work.
It applies to anything committed: code, config, shipped content, docs. Skip it
for reading or exploring, scratch files, and work that was reverted. One task
gets **one** entry, however many files it touches.

## Changelog entry format

Newest first, directly under the `<!-- entries -->` line. Keep each entry to
about 6 lines. Detail belongs in code comments and the commit message.

```markdown
### YYYY-MM-DD · area · Short title in plain words
- **What:** what is now different, in one sentence.
- **Why:** the reason; the part worth reading in six months.
- **Files:** `src/a.ts`, `src/b.tsx`
- **Status:** verified (how) | untested | partial (what is left)
```

Area is one of: collections, orders, cart, checkout, shipping, coupons, payments, auth, admin, media, seed, api, config, deps, docs. A change that alters the API contract between the two
repos (fields, endpoints, response shapes) uses `api`. It is logged in **both**
repos and updated in both maps.

Be honest: say when something is partial, a workaround, or untested. Use
today's real date.

When the changelog passes ~300 lines, move all but the newest 40 entries into
`CHANGELOG-ARCHIVE.md`, newest first. Nobody reads the archive by default.

## Next.js 16

APIs differ from older versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).
