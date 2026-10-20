# Brownmoor — Backend

Payload 3 on Next.js, serving the admin panel and the storefront API. Postgres
for data, Vercel Blob for images.

The commerce layer is Payload's official `@payloadcms/plugin-ecommerce`, so
products, variants, carts, orders, transactions and addresses come from the
plugin. This repo configures it and adds the parts specific to Brownmoor.

## Running locally

You need a Postgres 17 database. Set `DATABASE_URL` in `.env`, then:

```bash
npm run dev
```

The admin panel is at http://localhost:3000/admin. The first account you create
there is made an admin automatically; every account created after that defaults
to `customer`.

## Configuration decisions

| Area | Decision |
| --- | --- |
| Currency | BDT only. Amounts stored as integers in poisha — ৳1,250.00 is `125000`. |
| Payment | Cash on delivery only. No gateway is integrated. |
| Catalog | Products have variants; price and inventory live per variant. |
| Media | Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, local disk otherwise. |
| Countries | Bangladesh only. The plugin's 40 built-in countries do not include it. |

## Collections

Ours, in `src/collections/`:

- **Users** — staff and shoppers share this collection, with a `roles` field of
  `admin` / `customer`. The plugin treats it as `customers`, so carts and orders
  relate straight to a user.
- **Media** — product photography, with `thumbnail`, `card` and `feature` sizes
  generated at upload. Publicly readable, admin-writable.
- **Categories** — self-nesting via `parent`, so `Cookware > Frying Pans` works
  without a schema change.

From the plugin: `products`, `variants`, `variantTypes`, `variantOptions`,
`carts`, `orders`, `transactions`, `addresses`.

The products collection ships with only prices, inventory and variant wiring —
title, slug, description, gallery, specifications and categories are added in
`src/collections/Products.ts`.

## Cash on delivery

`src/payments/cashOnDelivery.ts` implements the plugin's `PaymentAdapter`
interface with no gateway behind it. Checkout is two calls:

1. `POST /api/payments/cod/initiate` — validates the cart and creates a
   `pending` transaction. Returns a `reference`.
2. `POST /api/payments/cod/confirm-order` — pass that `reference` back. Creates
   the order, marks the cart purchased, links the two.

The transaction stays `pending` after confirmation on purpose: no money has
changed hands until the courier collects it. Staff mark it `succeeded` in the
admin panel once the cash is in. Confirming twice is rejected, so a
double-submitted checkout cannot produce two orders against one cart.

A shipping address is required to initiate — a cash-on-delivery order with
nowhere to deliver is unfulfillable — and `phone` is required on every address
so the courier can call ahead.

For the storefront, import `cashOnDeliveryAdapterClient` from the same file and
pass it to the ecommerce provider. It carries no server-only code.

## Environment

See `.env.example`. `BLOB_READ_WRITE_TOKEN` is optional locally but required in
any deployed environment — Vercel's filesystem is ephemeral, so uploads written
to local disk vanish on the next deploy.

`STOREFRONT_URL` must match the storefront's origin exactly or cookie-based auth
fails: it feeds both the CORS and CSRF allowlists.

## Commands

```bash
npm run dev              # admin + API on :3000
npm run seed             # install the demo catalogue
npm run seed:clear       # remove everything the seed installed
npm run generate:types   # regenerate src/payload-types.ts after schema changes
npm run lint
npm run test             # integration + e2e; both need a database
```

## Demo data

`src/seed/data.ts` defines a demo catalogue — 14 categories, 17 products (5 of
them with variants), and homepage hero copy. Both `seed` and `seed:clear` read
from that one file, so there is no second list to keep in sync.

`seed` is safe to re-run: every record is looked up first and skipped if
present, so it never duplicates.

`seed:clear` removes only what the seed created. It targets demo product slugs,
the demo variant type names, and media whose filename starts with `demo-`, so a
product you added yourself in the admin panel is never touched. It refuses to
run if any order references a demo product, since deleting a product out from
under an order would leave that order unreadable.

Replace the demo data with real products whenever you're ready — `seed:clear`
then `npm run seed` is a clean reset in between.

Run `generate:types` after any collection or field change — the generated types
are what keep the adapter and access control honest.
