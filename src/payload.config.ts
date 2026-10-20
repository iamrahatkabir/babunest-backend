import { postgresAdapter } from '@payloadcms/db-postgres'
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import {
  adminOrPublishedStatus,
  isAdmin,
  isAdminFieldLevel,
  isAuthenticated,
  isCustomerFieldLevel,
  isDocumentOwner,
  publicAccess,
} from './access'
import { Categories } from './collections/Categories'
import { Coupons } from './collections/Coupons'
import { Media } from './collections/Media'
import { ordersCollectionOverride } from './collections/Orders'
import { productsCollectionOverride } from './collections/Products'
import { Users } from './collections/Users'
import {
  variantOptionsCollectionOverride,
  variantsCollectionOverride,
  variantTypesCollectionOverride,
} from './collections/Variants'
import { currenciesConfig } from './currencies'
import { HomePage } from './globals/HomePage'
import { Navigation } from './globals/Navigation'
import { ShippingSettings } from './globals/ShippingSettings'
import { cashOnDeliveryAdapter } from './payments/cashOnDelivery'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// The storefront runs as a separate app on its own origin, so every request it
// makes to this API is cross-origin. Both `cors` and `csrf` must name that
// origin or authenticated (cookie-based) requests are rejected.
const storefrontURL = process.env.STOREFRONT_URL || 'http://localhost:3001'
const serverURL = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000'

// Vercel's filesystem is ephemeral, so uploads must go to Blob in any deployed
// environment. Locally the token is usually absent and Payload falls back to
// writing into the repo, which keeps `npm run dev` free of external setup.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    components: {
      // Renders nothing itself; it portals a count of unworked orders into the
      // Orders link. Payload offers no per-collection nav badge, and this slot
      // is the supported way in.
      afterNavLinks: ['@/components/ProcessingOrdersBadge#ProcessingOrdersBadge'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories, Coupons],
  globals: [HomePage, Navigation, ShippingSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  cors: [storefrontURL],
  csrf: [storefrontURL],
  sharp,
  plugins: [
    ecommercePlugin({
      access: {
        adminOnlyFieldAccess: isAdminFieldLevel,
        adminOrPublishedStatus,
        isAdmin,
        isAuthenticated,
        isCustomer: isCustomerFieldLevel,
        isDocumentOwner,
        publicAccess,
      },
      addresses: {
        addressFields: ({ defaultFields }) =>
          defaultFields.map((field) => {
            // Narrowing on `type` as well as `name` keeps the spread below
            // typed as a TextField rather than the whole Field union.
            if (field.type === 'text' && field.name === 'phone') {
              return {
                ...field,
                // A courier carrying a cash-on-delivery parcel needs to be able
                // to call ahead, so this is not optional here.
                admin: {
                  ...field.admin,
                  description: 'Required so the courier can contact the recipient.',
                },
                required: true,
              }
            }

            return field
          }),
        // Bangladesh is not among the plugin's 40 built-in countries, so the
        // list has to be stated explicitly or the country select renders empty.
        supportedCountries: [{ label: 'Bangladesh', value: 'BD' }],
      },
      carts: {
        // Shoppers can fill a basket before registering; the cart is claimed on
        // login via the context's `onLogin`.
        allowGuestCarts: true,
      },
      currencies: currenciesConfig,
      customers: {
        slug: 'users',
      },
      inventory: true,
      orders: {
        ordersCollectionOverride,
      },
      payments: {
        paymentMethods: [cashOnDeliveryAdapter()],
      },
      products: {
        productsCollectionOverride,
        variants: {
          variantOptionsCollectionOverride,
          variantsCollectionOverride,
          variantTypesCollectionOverride,
        },
      },
      transactions: true,
    }),
    ...(blobToken
      ? [
          vercelBlobStorage({
            collections: {
              media: true,
            },
            token: blobToken,
          }),
        ]
      : []),
  ],
})
