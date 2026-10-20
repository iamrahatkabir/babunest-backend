@AGENTS.md

# Working rules for this repo

## Log every change you make

**After making any change to this repository, append an entry to [CHANGELOG.md](CHANGELOG.md).**

This is not optional and not something to ask permission for — it is part of
finishing the work. A change that is not logged did not happen, as far as
anyone reading the repo later is concerned.

### When to write an entry

Write one when you have changed anything that is committed to the repo:

- source code, in `src/`
- configuration (`next.config.ts`, `package.json`, env examples)
- content that ships (policy page copy, admin field descriptions, seed data)
- documentation, including this file and the changelog's own structure

Do **not** write an entry for:

- reading, searching or exploring the code — only changes get logged
- scratch files, temporary scripts, or anything outside the repo
- work you attempted and reverted, leaving no net change

### When to write it

Write the entry **as part of the same turn as the change**, once the change is
complete and verified — not batched up at the end of a long session, where the
detail is already lost. If a single task touches several files toward one goal,
that is **one** entry, not one per file.

### Format

Newest entries go at the **top**, directly under the `# Changelog` heading.

```markdown
## YYYY-MM-DD — Short title in plain words

**What changed:** One or two sentences on what is now different.

**Why:** The reason. This is the part worth reading in six months.

**Files:** `path/to/file.ts`, `path/to/other.tsx`
```

Use today's real date. Keep the title descriptive — "Fix delivery charge
mismatch between checkout and order" rather than "bug fix".

### Be honest in the entry

The changelog is a record, not a pitch:

- If something is a partial fix, say what is still outstanding.
- If you worked around a problem rather than solving it, say so.
- If a change is untested, say that too. Do not describe work as verified
  when it was not run.

## Other rules

This repo pulls in an `AGENTS.md` maintained by `next dev` (imported at the
top of this file). It still applies — in particular, this is Next.js 16, whose
APIs differ from older versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js code.

The storefront lives in its own repository, `babunest-frontend`.
Changes that cross the API boundary need an entry in both changelogs.
