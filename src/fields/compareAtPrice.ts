import type { NumberField } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { BDT, currenciesConfig } from '../currencies'

/**
 * The "was" price, shown struck through next to the live price.
 *
 * Stored in the minor unit exactly like `priceInBDT`, and built with the
 * plugin's own `amountField` so it uses the same admin input and column
 * renderer — a plain number field here would show raw poisha to staff.
 *
 * Leave it empty for a product that is not on sale. The storefront treats
 * "empty, or not greater than the live price" as no discount, so a stale value
 * can never render a negative or zero percentage.
 */
export const compareAtPriceField = (): NumberField =>
  amountField({
    currenciesConfig,
    currency: BDT,
    overrides: {
      name: 'compareAtPriceInBDT',
      admin: {
        description:
          'Original price, shown struck through. Leave empty when the product is not on sale.',
      },
      label: 'Compare-at price (BDT)',
    },
  })
