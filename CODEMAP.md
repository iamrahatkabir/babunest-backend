# Backend code map
_Last verified: 2026-10-20_

Read this instead of the code. Open only the files a task names. Update it when
a change makes a line untrue (see `CLAUDE.md`).

## Stack
- Payload 3.88.0 (`payload`, `@payloadcms/next`, `ui`, `richtext-lexical`), Next 16.3.0, React 19.2.6, TS 5.7.3, ESM.
- DB: `@payloadcms/db-postgres`, pool from `DATABASE_URL`.
  - Dev uses push. Production uses migrations in `src/migrations/`, applied by Railway's pre-deploy step `npm run migrate`.
- Hosting: Railway (`railway.json`). See DEPLOYMENT.md.
- Plugins:
  - `@payloadcms/plugin-ecommerce` ^3.88.0: products + variants, carts (guest carts too), orders, transactions, addresses, inventory, payments.
- Media storage: local disk at `MEDIA_DIR` (default `./media`). In production that is a Railway volume at `/data/media`. No cloud storage adapter.
- Editor: lexical. Images: sharp 0.34.2.
- Currency: BDT only (`src/currencies.ts`), symbol ৳, 2 decimals. **All money is integer poisha** (৳1 = 100).
- Addresses support only country `BD`. `phone` is forced required on addresses (payload.config.ts:95-105).
- Tests: Vitest 4 (jsdom) and Playwright 1.58.

## Commands
- `dev` / `devsafe`: next dev. `devsafe` deletes `.next` first.
- `build` / `start`: next build (8 GB heap) / next start.
- `generate:types` → `src/payload-types.ts`.
- `generate:importmap` → `src/app/(payload)/admin/importMap.js`.
- `payload`: Payload CLI. `lint`: eslint.
- `migrate`: `payload migrate`. Railway runs it pre-deploy. New migration: `npm run payload migrate:create <name>`.
- `seed` / `seed:clear`: tsx with `--env-file=.env`. Installs or removes the demo catalogue.
- `carts:prune [-- --apply]`: finds orphaned cart lines; deletes them only with `--apply`.
- `test`: runs `test:int` (vitest), then `test:e2e` (playwright).

## Layout
src/
- payload.config.ts: buildConfig. Registers collections, globals, plugins, cors/csrf and the admin nav badge.
- access/index.ts: access functions
  - isAdmin, isAdminFieldLevel, isAdminPanelUser, isAuthenticated, isCustomerFieldLevel
  - isDocumentOwner, isSelfOrAdmin, publicAccess, adminOrPublishedStatus
  - isAdminOrDocumentOwner (unused)
- currencies.ts: the `BDT` Currency and `currenciesConfig`.
- collections/
  - Own collections: Users.ts, Media.ts, Categories.ts, Coupons.ts.
  - `CollectionOverride`s of plugin collections: Products.ts, Variants.ts, Orders.ts.
  - OrderItemRowLabel.tsx (client): `OrderItemRowLabel` ("01 — Title × qty") and `OrderItemImage` (ui field). Both fetch `/api/products/:id?depth=2`, cached per id.
- components/ProcessingOrdersBadge.tsx (client): portals a count of `processing` orders onto the `#nav-orders` link. Refreshes every 60s and on focus.
- globals/
  - HomePage.ts, Navigation.ts, ShippingSettings.ts.
  - SectionRowLabel.tsx: row label for home-page sections.
- fields/
  - slugField.ts: `slugify` and the slug field.
  - compareAtPrice.ts: `compareAtPriceInBDT`.
  - weight.ts: `weightGrams`.
- coupons/calculate.ts: `resolveCoupon`. The single source of coupon validity and discount.
- shipping/calculate.ts: `resolveZone` and `quoteShipping`.
- payments/cashOnDelivery.ts: `cashOnDeliveryAdapter` (server) and `cashOnDeliveryAdapterClient` (for the storefront).
- hooks/pruneCartItems.ts: product `beforeDelete` hook.
- scripts/pruneCarts.ts: raw-SQL repair of orphaned cart lines.
- seed/data.ts (demo data, no side effects), seed/run.ts, seed/clear.ts.
- app/(frontend)/layout.tsx + page.tsx: `/` redirects to `/admin`.
- app/(payload)/: Payload-generated admin, REST `api/[...slug]`, `api/graphql`, `api/graphql-playground`, layout and importMap.js. custom.scss is empty.
- payload-types.ts: GENERATED. Do not edit by hand.
- migrations/: `20261020_170531_initial` (the full schema) + `index.ts`. Generated; add new ones, never edit applied ones.

root: `railway.json` (build / pre-deploy migrate / start), `docker-compose.yml` (local Postgres only, DB `babunest_dev`).

tests/
- int/api.int.spec.ts: one test, `payload.find({collection:'users'})`.
- e2e/admin.e2e.spec.ts: logs in, then opens the dashboard, users list and users create.
- e2e/frontend.e2e.spec.ts: stale (see Gotchas).
- helpers/login.ts, seedUser.ts: test user dev@payloadcms.com / `test`, role admin.

## Data model

**users** (auth). Doubles as the plugin's `customers` collection.
- Fields: name:text; roles:select[] (admin|customer), required, default ['customer']. Only admins can create or update roles.
- Hook: on create, roles becomes ['admin'] when the users count is 0, and ['customer'] when roles is empty.
- Access: admin panel = isAdminPanelUser; create = public (storefront signup); read/update = isSelfOrAdmin; delete = admin.

**media** (upload, image/*).
- Fields: alt:text (required). Sizes: thumbnail 300², card 640², feature w1200.
- `staticDir` = `path.resolve(MEDIA_DIR || 'media')`. Files are served at `/api/media/file/<name>`.
- Access: read public; write admin.

**categories**
- Fields: title (required), slug (slugField), description:textarea, image→media, parent→categories (filterOptions only blocks choosing itself).
- Access: read public; write admin.

**coupons** (group Storefront). Admin-only for every operation, read included.
- code: text, required, unique, indexed; trimmed and uppercased in beforeValidate.
- active: checkbox, default true.
- discountType: percentage | fixed. percentage: number 1–100.
- In poisha (amountField): maxDiscount, fixedAmount, minOrderAmount.
- startsAt / expiresAt: date. usageLimit: number ≥1. usageCount: number, readOnly, default 0.
- Endpoint: POST `/validate`.

**products** (plugin override, drafts via `_status`).
- Tab Details:
  - title (required), shortDescription (max 300), description:richText, gallery[] {image→media, required}, minRows 1.
  - Plugin fields: priceInBDT / priceInBDTEnabled, inventory, enableVariants, variantTypes (hidden), variants join (shown when enableVariants).
  - compareAtPriceInBDT, only when there are no variants.
- Tab Specifications: specifications[] {label, value}, careInstructions, weightGrams (only when no variants).
- Sidebar: slug, categories→categories[], featured:checkbox, relatedProducts→products[] (published only, not itself).
- Hook: beforeDelete runs pruneCartItems.
- Access comes from the plugin (adminOrPublishedStatus for reads).

**variants** (plugin override, hidden from nav).
- Adds: `label`:text (required, after title), compareAtPriceInBDT, weightGrams.
- Plugin `options` is hidden and not required; its validate is forced to `()=>true`.
- Variants are per product; the global types/options are unused.

**variantTypes**, **variantOptions**: plugin collections, hidden. Only admin descriptions and columns are changed.

**orders** (plugin override).
- Status options are replaced with: processing, confirmed, in-office, send-to-courier, delivered, cancelled, returned.
- The shippingAddress tab is removed, but the group is re-added hidden so its columns survive.
- Added fields: couponCode (readOnly), discountAmount, shippingAmount (hidden), shippingZone, totalWeightGrams (hidden).
- Virtual afterRead fields: customerName, customerPhone, deliveryAddress, orderTotal (`৳` + amount/100).
- `amount` is the grand total. The items array gets the custom RowLabel and a productImage ui field.

**carts**, **transactions**, **addresses**: plugin defaults.
- Transactions gain a `cod` group: reference (indexed), couponCode, shippingAddressSnapshot:json.
- Carts have secret, customer, purchasedAt, status, subtotal.

**Globals** (read public, update admin)
- **home-page**
  - heroSlides[] {image req, link, alt}; heroAutoplaySeconds (default 5).
  - Fallback hero: image, heading, subheading, ctaLabel, ctaLink.
  - topCollectionsHeading, topCollections→categories[].
  - sections[], max 5: {eyebrow, heading req, intro, products→published products, viewAllLabel, viewAllUrl}.
- **navigation**: menu→categories[] (in menu order).
- **shipping-settings**
  - zones[], min 1: {label req, cities (comma-separated text), baseRate (poisha, req), includedWeightGrams (default 1000), surchargePerKg (poisha), isDefault}.
  - freeShippingThreshold: number **in whole taka**. defaultItemWeightGrams: default 500.
  - Default zones: Inside Dhaka 8000 + 2000/kg; Outside Dhaka (default) 15000 + 3000/kg.

## API & endpoints
- Base routes: REST `/api/*`; GraphQL POST `/api/graphql`; playground GET `/api/graphql-playground`; admin `/admin`. `/` redirects to `/admin`.
- `POST /api/coupons/validate` (Coupons.ts:41-66)
  - Body: `{code, subtotal}`, subtotal in poisha.
  - Always 200: `{valid:true, code, discount}` or `{valid:false, reason}`.
- Plugin payments (adapter name `cod`):
  - `POST /api/payments/cod/initiate`
  - `POST /api/payments/cod/confirm-order` (body includes `reference`)
- Plugin carts: `POST /api/carts/:id/add-item | update-item | remove-item | clear | merge`. Guests pass `secret`; merge needs auth.
- Storefront reads: `/api/globals/home-page`, `/api/globals/navigation`, `/api/globals/shipping-settings`, products, categories.
- Admin-side fetches:
  - Badge: `/api/orders?where[status][equals]=processing&limit=0`.
  - Order row label: `/api/products/:id?depth=2`.

## Business rules
- **Money:** integer poisha everywhere. Seed converts taka with `taka()` (seed/run.ts:19).
- **Coupons** (coupons/calculate.ts)
  - Codes are normalised (trim + uppercase). Inactive and missing codes give the same "not valid" reason.
  - Checks, in order: startsAt, expiresAt, usageLimit vs usageCount, minOrderAmount.
  - Percentage discount = round(subtotal × pct / 100), capped at maxDiscount when maxDiscount > 0. Fixed discount = fixedAmount.
  - The discount is clamped to [0, subtotal]. A zero discount counts as invalid.
- **Shipping** (shipping/calculate.ts)
  - Zone: the first zone whose city list contains the address city (case-insensitive); else the `isDefault` zone; else zones[0]. No zones throws.
  - Line weight: variant.weightGrams, else product.weightGrams, else defaultItemWeightGrams; times qty.
  - Free when the pre-discount subtotal ≥ threshold × 100.
  - Otherwise: baseRate + ceil(max(0, weight − includedWeightGrams) / 1000) × surchargePerKg.
- **Cash-on-delivery flow** (payments/cashOnDelivery.ts)
  - initiate:
    - Requires currency, a non-empty cart, customerEmail, cart.subtotal > 0 and shippingAddress.
    - Creates a pending transaction with a `cod_<hex>` reference, flattened items and amount = cart.subtotal.
    - Stores cod.couponCode (read from raw `req.data`) and shippingAddressSnapshot.
  - confirm:
    - Finds the transaction by reference. Fails if it already has an order or is not pending.
    - Recomputes shipping and coupon on the server.
    - Creates the order: amount = subtotal − discount + shipping, status `processing`.
    - Then, in parallel: coupon usageCount +1, cart.purchasedAt set, order linked to the transaction.
    - The transaction **stays pending**. Staff mark it succeeded once the cash is collected.
- **Stock:** the plugin's confirmOrder decrements variant (or product) `inventory` by qty after the adapter returns (`inventory: true`). Nothing in this repo's source does it.
- **Cart pruning**
  - hooks/pruneCartItems.ts runs before a product is deleted. It removes that product's lines, and null-product lines, from unpurchased carts (limit 1000).
  - scripts/pruneCarts.ts cleans up rows left over from before the hook existed.
- **Order status:** processing → confirmed → in-office → send-to-courier → delivered; or cancelled / returned.
  - These are options only; no hooks enforce transitions (Orders.ts:76-92).
  - The badge counts `processing` only.
- **Drafts:** non-admins read only `_status: published` (access/index.ts:95).

## Auth & access
- Users have roles `admin` | `customer`. Only admins can open the admin panel (`access.admin`).
- First user becomes admin: Users.ts:43-68.
- Anyone can register. A non-admin's roles input is stripped by field access.
- isDocumentOwner returns `Where {customer: user.id}`, so customers see only their own orders, carts and addresses.
- Users use isSelfOrAdmin (filters on `id`) because users have no `customer` column.
- isCustomerFieldLevel = logged in and not admin. The plugin uses it to auto-assign the customer on addresses.
- CORS and CSRF are both `[STOREFRONT_URL]` (payload.config.ts:76-77). The storefront's cookie auth depends on it.

## Env vars
- `DATABASE_URL`: required. Falls back to ''. **Currently empty in local `.env`**, so the app will not boot until a new DB is set.
- `PAYLOAD_SECRET`: required. Falls back to ''.
- `PAYLOAD_PUBLIC_SERVER_URL`: serverURL. Default http://localhost:3000.
- `STOREFRONT_URL`: cors/csrf origin. Default http://localhost:3001. Must be set in prod.
- `MEDIA_DIR`: where uploads are written. Default `./media`. Railway: `/data/media` on a volume.
- `test.env`: NODE_OPTIONS only. Vitest and Playwright load `.env` through dotenv.

## Seed & scripts
- **seed/data.ts**
  - 14 categories (5 top-level plus children).
  - Variant types: size (16–30cm) and capacity (3/5/7 litre).
  - 17 core products (some with variants), plus 45 generated `bakeware-NN` filler products: every 3rd on sale, every 7th out of stock.
  - HOME_PAGE copy and 5 HOME_SECTIONS (by product slug). Demo images are named `demo-<slug>.png`.
- **seed/run.ts**
  - Idempotent: looks up each record by slug or name and skips what exists. Placeholder PNGs are made with sharp.
  - Products are created published. Variants are created or repaired even when the product already exists.
  - Home hero and sections are each set only if empty.
- **seed/clear.ts**
  - Refuses if any order references a demo product.
  - Deletes, in order: demo variants, products, the home-page hero and sections, demo media, variant types and options, and categories (children first).
- **scripts/pruneCarts.ts:** dry-run by default. Uses the raw pool to SELECT / DELETE `carts_items WHERE product_id IS NULL`.

## Tests
- `npm run test:int`: vitest over `tests/int/**/*.int.spec.ts` (jsdom). Needs a live DB from `.env`.
- `npm run test:e2e`: playwright, chromium. webServer is `pnpm dev` on :3000 with reuseExistingServer.
- Coverage is template-level only. Coupons, shipping, COD and hooks have no tests.

## Gotchas
- **Brownmoor name still hard-coded**
  - src/app/(frontend)/layout.tsx:4-5: metadata "Brownmoor.com Admin".
  - src/seed/run.ts:68 and :231: hero placeholder text.
  - src/seed/clear.ts:25.
  - README.md:1,8.
  - `BM-` spec prefix in seed/data.ts (BAKEWARE_FILLER).
- **Money units are mixed:** `freeShippingThreshold` is in whole taka (×100 in shipping/calculate.ts:106-109). Every other amount is poisha.
- Free shipping is tested against the **pre-discount** subtotal (cashOnDelivery.ts:195-200).
- Coupon `usageCount` is incremented read-then-+1, not atomically. Concurrent orders can overshoot usageLimit (cashOnDelivery.ts:252-258).
- initiate reads couponCode from `req.data`, because the plugin drops unknown body keys (cashOnDelivery.ts:305).
- Validate's reason for an empty code or subtotal ≤ 0 is in Bengali (Coupons.ts:49). All other reasons are English (coupons/calculate.ts:25-38).
- **Never delete these hidden fields:** Orders `shippingAddress` / `shippingAmount` / `totalWeightGrams` and Variants `options`. Removing them from config drops DB columns or join tables. Hide them instead.
- Products defaultColumns lists `'prices'` (Products.ts:64), but the field is `priceInBDT`.
- Products.ts:48-50 has imports in mid-file. Orders.ts:9-15 has a misplaced doc comment.
- The users roles hook runs `payload.count` on every create (Users.ts:52).
- pruneCartItems handles at most 1000 carts per delete (hooks/pruneCartItems.ts:25).
- tests/e2e/frontend.e2e.spec.ts expects the title "Payload Blank Template" and an h1, but `/` redirects to /admin, so it fails.
- playwright.config.ts:37 uses `pnpm dev`, but the repo uses npm (package-lock.json).
- ProcessingOrdersBadge depends on Payload's `nav-orders` element id (ProcessingOrdersBadge.tsx:28).
- After adding or renaming admin component paths (e.g. `@/collections/OrderItemRowLabel#…`), run `generate:importmap`.
- **Schema changes need a migration.** Any change to collection or field config needs `npm run payload migrate:create <name>`, committed with it, or production won't have the columns.
- Never run `npm run dev` against the production DB. Push mode conflicts with migrations.
- Media is on a single volume, so the backend must run as one replica.
