# Deploying Babunest on Railway

Everything runs in **one Railway project** with three services. This file is
kept identical in both repositories.

| Service name | Source | Serves |
| --- | --- | --- |
| `Postgres` | Railway database template | the database |
| `backend` | GitHub `iamrahatkabir/babunest-backend` | admin panel + API |
| `frontend` | GitHub `iamrahatkabir/babunest-frontend` | the shop |

Use these service names exactly: the variables below reference them.
Pick the **Singapore** region for all three, since it is closest to
Bangladesh.

## What the repos already handle

- **Backend `railway.json`:** build `npm run build`, start `npm run start`.
  The **pre-deploy** step `npm run migrate` applies database migrations before
  each release goes live.
- **Frontend:** detected automatically. `npm start` listens on Railway's
  `PORT`.
- **Images** are stored on the backend's own disk, under `MEDIA_DIR`. On
  Railway that is a volume, so uploads survive redeploys.

## 1. Create the project and database

1. Railway → **New Project** → **Deploy PostgreSQL**. Rename the service to
   `Postgres` if it isn't already.
2. In the same project: **+ Create → GitHub Repo → babunest-backend**. Rename
   it to `backend`.
3. **+ Create → GitHub Repo → babunest-frontend**. Rename it to `frontend`.

## 2. Public URLs

For both `backend` and `frontend`: **Settings → Networking → Generate
Domain**. Do this before setting the variables, because the variables
reference these domains.

## 3. Backend

**Volume:** right-click the `backend` service → **Attach volume**. Set the
mount path to `/data`.

**Variables** (`backend` → Variables → Raw editor):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
PAYLOAD_SECRET=<a long random string, e.g. from: openssl rand -hex 32>
PAYLOAD_PUBLIC_SERVER_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
STOREFRONT_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
MEDIA_DIR=/data/media
```

- `DATABASE_URL` uses Railway's private network. It needs no SSL setup and
  costs no egress.
- Once `PAYLOAD_SECRET` is set, never change it: it signs logins, so changing
  it logs everyone out and breaks password-reset links.
- `STOREFRONT_URL` must match the shop's URL exactly. It is the CORS and CSRF
  allowlist, and a mismatch silently breaks the cart.

## 4. Frontend

**Variables:**

```
NEXT_PUBLIC_PAYLOAD_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_SITE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

- `NEXT_PUBLIC_*` values are **baked in at build time**. After changing one,
  redeploy so it rebuilds.
- `NEXT_PUBLIC_PAYLOAD_URL` must be the backend's **public** URL, not the
  private one. Browsers load product images from it directly.

## 5. Deploy order

1. Deploy `backend` first. Its pre-deploy step creates every table in the
   empty database. In the deploy logs, look for the migration
   `20261020_170531_initial` being applied.
2. Then deploy `frontend`. Pages are cached for 60 seconds, so if the frontend
   built while the backend was down, the home page fills in within a minute.

## 6. First run

1. Open `https://<backend-domain>/admin` and create the first account. It
   becomes the admin automatically; every later account is a customer.
2. Add categories and products. To load demo data instead, set `DATABASE_URL`
   locally to the Railway database's **public** URL (Postgres → Connect) and
   run `npm run seed`. `npm run seed:clear` removes only demo data.
3. In **Globals**, set the Home Page, Navigation and Shipping Settings.

## 7. Check it works

- The shop's home page lists products.
- Add to cart increments the header count. This proves the API proxy and CORS
  are right.
- A test order appears under **Orders** in the admin.
- An image uploaded in the admin still shows after a backend redeploy. This
  proves the volume is mounted.

## Changing the database schema later

Locally, `npm run dev` changes the dev database directly. Before pushing a
change to collections or fields:

```bash
npm run payload migrate:create <short-name>
```

Commit the new files in `src/migrations/`. Railway's pre-deploy step applies
them on the next deploy.

**Never point `npm run dev` at the production database.** Dev mode alters the
schema directly and will conflict with migrations.

## Custom domain

Add it to `frontend` (Settings → Networking → Custom Domain). Then update
`STOREFRONT_URL` on the backend to `https://<your-domain>`. The frontend's
`NEXT_PUBLIC_SITE_URL` updates by itself only if it uses
`${{RAILWAY_PUBLIC_DOMAIN}}` and the custom domain is the primary one.
Otherwise, set it by hand and redeploy. If the backend gets its own domain,
update `PAYLOAD_PUBLIC_SERVER_URL` and the frontend's
`NEXT_PUBLIC_PAYLOAD_URL`.

## Meta product feed

The feed is served at `https://<shop-domain>/feed/meta.xml`. In Commerce
Manager: open the catalogue → **Data sources → Add items → Data feed** →
scheduled URL. Paste the feed address and set the currency to **BDT**.

## Known rough edges

- **No email adapter.** Password resets and order emails go to the backend
  log, not to inboxes.
- **Orders are not sent to Steadfast.** They are entered into the courier by
  hand.
- **One backend instance only.** Images live on one volume, which Railway
  attaches to a single replica. Scaling out needs S3-compatible storage first.
