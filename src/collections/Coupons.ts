import type { CollectionConfig } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { isAdmin } from '../access'
import { resolveCoupon } from '../coupons/calculate'
import { BDT, currenciesConfig } from '../currencies'

/**
 * Discount codes.
 *
 * Admin-only in every direction, reads included. A publicly readable collection
 * would let anyone list every unreleased code, so the storefront never queries
 * this — it posts a single code to /api/coupons/validate and gets back only
 * that code's discount.
 *
 * Amounts are in poisha, like everything else. Percentages are whole numbers.
 */
export const Coupons: CollectionConfig = {
  slug: 'coupons',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: isAdmin,
    update: isAdmin,
  },
  admin: {
    defaultColumns: ['code', 'discountType', 'active', 'usageCount', 'expiresAt'],
    description:
      'Discount codes customers enter at checkout. The discount is always recalculated on the server when the order is placed, so a code cannot be edited into a bigger saving from the browser.',
    group: 'Storefront',
    useAsTitle: 'code',
  },
  /**
   * The one way the storefront may touch this collection.
   *
   * Takes a single code and a subtotal and answers only about that code. The
   * collection itself stays admin-only, so nobody can list the codes that have
   * not been announced yet.
   */
  endpoints: [
    {
      handler: async (req) => {
        const body = (await req.json?.()) as undefined | { code?: unknown; subtotal?: unknown }
        const code = typeof body?.code === 'string' ? body.code : ''
        const subtotal = typeof body?.subtotal === 'number' ? body.subtotal : 0

        if (!code || subtotal <= 0) {
          return Response.json({ reason: 'কুপন কোডটি সঠিক নয়।', valid: false }, { status: 200 })
        }

        const result = await resolveCoupon({ code, payload: req.payload, subtotal })

        // 200 either way: an unusable code is a normal answer to a normal
        // question, not a failed request, and the storefront reads `valid`.
        return Response.json(
          result.valid
            ? { code: result.coupon.code, discount: result.discount, valid: true }
            : { reason: result.reason, valid: false },
          { status: 200 },
        )
      },
      method: 'post',
      path: '/validate',
    },
  ],
  fields: [
    {
      name: 'code',
      type: 'text',
      admin: {
        description: 'What the customer types. Case does not matter — it is stored uppercase.',
      },
      hooks: {
        // Stored uppercase and trimmed so "eid20", "Eid20 " and "EID20" are one
        // code rather than three, and lookups can match exactly.
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value)],
      },
      index: true,
      required: true,
      unique: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      admin: {
        description: 'Untick to switch the code off immediately, without deleting its history.',
        position: 'sidebar',
      },
      defaultValue: true,
    },
    {
      name: 'discountType',
      type: 'select',
      admin: { description: 'How the saving is worked out.' },
      defaultValue: 'percentage',
      options: [
        { label: 'Percentage off', value: 'percentage' },
        { label: 'Fixed amount off', value: 'fixed' },
      ],
      required: true,
    },
    {
      name: 'percentage',
      type: 'number',
      admin: {
        condition: (data) => data?.discountType === 'percentage',
        description: 'Whole number — 20 means 20% off the subtotal.',
      },
      max: 100,
      min: 1,
    },
    amountField({
      currenciesConfig,
      currency: BDT,
      overrides: {
        name: 'maxDiscount',
        admin: {
          condition: (data) => data?.discountType === 'percentage',
          description:
            'Optional ceiling on a percentage discount, so "20% off" cannot become a large saving on a large order. Leave empty for no cap.',
        },
        label: 'Maximum discount (BDT)',
      },
    }),
    amountField({
      currenciesConfig,
      currency: BDT,
      overrides: {
        name: 'fixedAmount',
        admin: {
          condition: (data) => data?.discountType === 'fixed',
          description: 'Taken straight off the subtotal.',
        },
        label: 'Discount amount (BDT)',
      },
    }),
    amountField({
      currenciesConfig,
      currency: BDT,
      overrides: {
        name: 'minOrderAmount',
        admin: {
          description:
            'Smallest subtotal the code works on, before delivery. Leave empty to allow any order.',
        },
        label: 'Minimum order (BDT)',
      },
    }),
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          admin: {
            description: 'Leave empty to start immediately.',
            width: '50%',
          },
        },
        {
          name: 'expiresAt',
          type: 'date',
          admin: {
            description: 'Leave empty for no expiry.',
            width: '50%',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'usageLimit',
          type: 'number',
          admin: {
            description: 'Total times the code may be used. Leave empty for unlimited.',
            width: '50%',
          },
          min: 1,
        },
        {
          name: 'usageCount',
          type: 'number',
          admin: {
            description: 'Counted up when an order is placed.',
            readOnly: true,
            width: '50%',
          },
          defaultValue: 0,
        },
      ],
    },
  ],
  labels: {
    plural: 'Coupons',
    singular: 'Coupon',
  },
}
