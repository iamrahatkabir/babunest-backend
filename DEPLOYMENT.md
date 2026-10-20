# Deploying Babunest

Two apps in two repositories, deployed as two services. The hosting platform
has not been chosen yet, so this guide covers what any platform needs rather
than one platform's steps. This file is kept identical in both repositories,
since deploying either app means touching the other.

| Service | Repository | Serves |
| --- | --- | --- |
| Backend | `iamrahatkabir/babunest-backend` | Admin panel + API (Payload) |
| Storefront | `iamrahatkabir/babunest-frontend` | The shop |

Both are Next.js 16 apps: `npm run build`, then `npm run start`. The backend
also ships a `Dockerfile` for container hosts.

Deploy the backend first — the storefront needs its URL.

---

## The database

There is no database connected right now. The Brownmoor database was
disconnected on 2026-10-20 so Babunest could start fresh.

Create a new Postgres database and put its connection string in the
backend's `DATABASE_URL`. If the host runs serverless functions, use a pooled
connection string, since many short-lived connections will exhaust a direct
endpoint.

**Payload only creates tables automatically in development.** In production it
expects migrations, and will not alter the schema on boot:

```bash
# in the babunest-backend repo
npm run payload migrate:create
npm run payload migrate
```

Commit the generated files in `src/migrations`, and run `migrate` as part of
each deploy, before or as part of the build.

## Image storage — not optional on most hosts

Uploaded product images are written to `./media` on local disk unless
`BLOB_READ_WRITE_TOKEN` is set, in which case they go to Vercel Blob. Neither
is settled for the new platform:

- On a host with a **persistent disk** (a VPS, a Docker volume), `./media`
  works as long as it lives on that disk.
- On a host with an **ephemeral filesystem** (most serverless and container
  platforms), every upload disappears on the next deploy. Swap the Blob adapter
  in `src/payload.config.ts` for Payload's S3 adapter, which also works with
  Cloudflare R2, before going live.

## Backend environment

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the new Postgres connection string |
| `PAYLOAD_SECRET` | a long random string; keep it stable once set |
| `PAYLOAD_PUBLIC_SERVER_URL` | the backend's own public URL |
| `STOREFRONT_URL` | the storefront's public URL, exactly |
| `BLOB_READ_WRITE_TOKEN` | only if still using Vercel Blob |

`PAYLOAD_SECRET` signs auth tokens. Changing it invalidates every existing
session and password-reset link.

`STOREFRONT_URL` feeds both the CORS and CSRF allowlists. If it is wrong, the
cart breaks in a way that looks like nothing is happening, because requests
are rejected as cross-origin.

## Storefront environment

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_PAYLOAD_URL` | the backend's public URL |
| `NEXT_PUBLIC_SITE_URL` | the storefront's own URL, no trailing slash |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | optional |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional |

`NEXT_PUBLIC_PAYLOAD_URL` does two jobs: server-side data fetching, and the
`/api/*` rewrite in `next.config.ts` that proxies cart and checkout calls to
Payload. If it is wrong, products render but the cart silently fails.

`NEXT_PUBLIC_*` values are baked in at build time, so changing one needs a
rebuild, not just a restart.

`NEXT_PUBLIC_SITE_URL` builds absolute product links in the Meta feed. Left
unset it falls back to `http://localhost:3001`, and every link in the feed
points at a machine Meta cannot reach.

`next.config.ts` allows images from the backend's host and from
`*.public.blob.vercel-storage.com`. If image storage moves elsewhere, add that
host to `images.remotePatterns`.

## First run

1. Open `<backend>/admin` and create the first account. It becomes an admin
   automatically; every account after it defaults to customer.
2. Add products, or load the demo catalogue with `npm run seed` in the backend
   repo. `seed:clear` only ever removes demo data.
3. In **Globals → Home Page**, upload the hero banner and arrange the product
   sections.

## Check it works

- Storefront home page lists products
- Add to cart increments the header count — this proves the API proxy and CORS
  are right
- A test order appears under **Orders** in the admin
- An uploaded image survives a redeploy — this proves image storage is
  persistent

## Meta product feed

The storefront publishes a catalogue feed for Facebook and Instagram at
`https://<storefront-domain>/feed/meta.xml`. In Commerce Manager: open the
catalogue, go to **Data sources → Add items → Data feed**, choose the
scheduled-URL option, paste that address and set the currency to **BDT**.

Meta fetches the feed from its own servers, so it has to be publicly reachable.
The same goes for its product images.

## Known rough edges

- **No email adapter is configured.** Password resets and order confirmations
  are written to the server log rather than sent.
- **Orders are not yet sent to Steadfast.** Every order is read from the admin
  and entered into the courier by hand.
