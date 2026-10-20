import type { GlobalConfig } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { isAdmin } from '../access'
import { BDT, currenciesConfig } from '../currencies'

/**
 * Delivery zones and their rates.
 *
 * A global rather than hardcoded constants because courier pricing changes and
 * shouldn't need a deploy. Publicly readable so the storefront can show a
 * shipping estimate before checkout — the authoritative figure is still
 * recalculated server-side when the order is placed.
 *
 * Zones are matched against the shipping address city, in list order, with the
 * zone marked `isDefault` used when nothing matches. Order matters: put the
 * most specific zone first.
 */
export const ShippingSettings: GlobalConfig = {
  slug: 'shipping-settings',
  access: {
    read: () => true,
    update: isAdmin,
  },
  admin: {
    group: 'Storefront',
  },
  fields: [
    {
      name: 'zones',
      type: 'array',
      admin: {
        description:
          'Checked top to bottom. The first zone whose cities match the delivery address wins.',
      },
      defaultValue: [
        {
          baseRate: 8000,
          cities: 'dhaka',
          includedWeightGrams: 1000,
          isDefault: false,
          label: 'Inside Dhaka',
          surchargePerKg: 2000,
        },
        {
          baseRate: 15000,
          cities: '',
          includedWeightGrams: 1000,
          isDefault: true,
          label: 'Outside Dhaka',
          surchargePerKg: 3000,
        },
      ],
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: { description: 'Shown to the customer at checkout.' },
          required: true,
        },
        {
          name: 'cities',
          type: 'text',
          admin: {
            description:
              'Comma-separated city names this zone covers, e.g. "dhaka, savar". Case-insensitive. Leave empty for the fallback zone.',
          },
        },
        amountField({
          currenciesConfig,
          currency: BDT,
          overrides: {
            name: 'baseRate',
            admin: { description: 'Charged for any parcel up to the included weight.' },
            label: 'Base rate (BDT)',
            required: true,
          },
        }),
        {
          type: 'row',
          fields: [
            {
              name: 'includedWeightGrams',
              type: 'number',
              admin: {
                description: 'Weight covered by the base rate, in grams.',
                width: '50%',
              },
              defaultValue: 1000,
              min: 0,
              required: true,
            },
            amountField({
              currenciesConfig,
              currency: BDT,
              overrides: {
                name: 'surchargePerKg',
                admin: {
                  description: 'Added per extra kilogram, or part of one, above the allowance.',
                  width: '50%',
                },
                label: 'Surcharge per extra kg (BDT)',
              },
            }),
          ],
        },
        {
          name: 'isDefault',
          type: 'checkbox',
          admin: {
            description:
              'Use this zone when no other matches. Exactly one zone should have this ticked.',
          },
        },
      ],
      minRows: 1,
      required: true,
    },
    {
      name: 'freeShippingThreshold',
      type: 'number',
      admin: {
        description:
          'Order subtotal in BDT above which delivery is free. Leave empty to always charge.',
      },
      label: 'Free shipping above (BDT)',
    },
    {
      name: 'defaultItemWeightGrams',
      type: 'number',
      admin: {
        description:
          'Assumed weight for a product with none set, so an unweighed item never ships as if it were free of charge.',
      },
      defaultValue: 500,
      min: 0,
      required: true,
    },
  ],
  label: 'Shipping Settings',
}
