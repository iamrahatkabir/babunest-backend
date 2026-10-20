import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import type { Field } from 'payload'

import { amountField } from '@payloadcms/plugin-ecommerce'

import { BDT, currenciesConfig } from '../currencies'

/**
 * Attaches the picture-bearing row label to the plugin's `items` array.
 *
 * That array sits inside a tabs field rather than at the top level, so the
 * tree is walked rather than indexed — a plugin upgrade that moves it one
 * level deeper should not silently drop the label.
 */
/**
 * Finds the plugin's shipping address group wherever it sits.
 *
 * Removing the tab must not remove the field: these are unnamed tabs, so the
 * group is stored at the top level, and dropping it from the config would drop
 * every shipping_address_* column — and with them the address on every order
 * already placed. It is re-attached hidden instead.
 */
const findShippingAddress = (fields: Field[]): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === 'shippingAddress') {
      return field
    }

    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const found = findShippingAddress(tab.fields)

        if (found) {
          return found
        }
      }
    }
  }

  return undefined
}

const withItemRowLabel = (fields: Field[]): Field[] =>
  fields.map((field) => {
    if ('name' in field && field.name === 'items' && field.type === 'array') {
      return {
        ...field,
        admin: {
          ...field.admin,
          components: {
            ...field.admin?.components,
            RowLabel: '@/collections/OrderItemRowLabel#OrderItemRowLabel',
          },
        },
        // Drawn first, so an open line leads with the photo and the fields
        // follow. A `ui` field stores nothing; it only renders.
        fields: [
          {
            name: 'productImage',
            type: 'ui',
            admin: {
              components: {
                Field: '@/collections/OrderItemRowLabel#OrderItemImage',
              },
            },
          },
          ...field.fields,
        ],
      }
    }

    // The plugin ships processing / completed / cancelled / refunded, which
    // describe a card payment. A cash-on-delivery shop tracks a parcel instead,
    // so the list is replaced with the steps staff actually work through.
    if ('name' in field && field.name === 'status' && field.type === 'select') {
      return {
        ...field,
        options: [
          { label: 'Processing', value: 'processing' },
          { label: 'Confirmed', value: 'confirmed' },
          { label: 'In office', value: 'in-office' },
          { label: 'Send to courier', value: 'send-to-courier' },
          { label: 'Delivered', value: 'delivered' },
          // The two ways a parcel comes back. Cash on delivery makes both
          // ordinary, and without them a refused order would sit in an earlier
          // state for ever and quietly distort the completion rate.
          { label: 'Cancelled', value: 'cancelled' },
          { label: 'Returned', value: 'returned' },
        ],
      }
    }

    if (field.type === 'tabs') {
      return {
        ...field,
        // The plugin's second tab holds nothing but the delivery address, and
        // the address already reads out on the list and in the sidebar. An
        // extra tab to hold one group is a click for no information.
        tabs: field.tabs
          .filter((tab) => !tab.fields.some((f) => 'name' in f && f.name === 'shippingAddress'))
          .map((tab) => ({ ...tab, fields: withItemRowLabel(tab.fields) })),
      }
    }

    if ((field.type === 'group' || field.type === 'array') && 'fields' in field) {
      return { ...field, fields: withItemRowLabel(field.fields) }
    }

    if (field.type === 'row' || field.type === 'collapsible') {
      return { ...field, fields: withItemRowLabel(field.fields) }
    }

    return field
  })

/**
 * The plugin's order has a single `amount`, which we treat as the grand total
 * — goods plus delivery. Splitting the parts out here means staff can see what
 * was actually charged for shipping, and the courier gets a parcel weight,
 * without having to recompute either from the line items.
 *
 * These are snapshots, deliberately. If rates change next month, an order
 * placed today must still show what the customer was quoted.
 */
export const ordersCollectionOverride: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection.admin,
    // Staff work this list to pack and dispatch, so the useful columns are who
    // to call, where it goes and what to collect. The plugin's default shows
    // none of those.
    defaultColumns: [
      'id',
      'customerName',
      'customerPhone',
      'deliveryAddress',
      'orderTotal',
      'status',
      'createdAt',
    ],
  },
  fields: [
    ...withItemRowLabel(defaultCollection.fields),
    // Kept in the schema, out of the panel. The virtual Address and Mobile
    // fields below surface what staff actually read off it.
    ...(() => {
      const shippingAddress = findShippingAddress(defaultCollection.fields)

      return shippingAddress
        ? [{ ...shippingAddress, admin: { ...shippingAddress.admin, hidden: true } } as Field]
        : []
    })(),
    {
      name: 'couponCode',
      type: 'text',
      admin: {
        description: 'Discount code used on this order, if any.',
        readOnly: true,
      },
      label: 'Coupon code',
    },
    amountField({
      currenciesConfig,
      currency: BDT,
      overrides: {
        name: 'discountAmount',
        admin: {
          description: 'Saving applied by the coupon. Already deducted from the order total.',
          readOnly: true,
        },
        label: 'Discount (BDT)',
      },
    }),
    amountField({
      currenciesConfig,
      currency: BDT,
      overrides: {
        name: 'shippingAmount',
        admin: {
          description: 'Delivery charge at the time of ordering. Included in the order total.',
          // Kept out of the panel but still recorded. Staff read the amount to
          // collect from the order total; the split only matters for accounts.
          hidden: true,
          readOnly: true,
        },
        label: 'Shipping charge (BDT)',
      },
    }),
    {
      name: 'shippingZone',
      type: 'text',
      admin: {
        description: 'Delivery zone this order was priced against.',
        readOnly: true,
      },
    },
    {
      name: 'totalWeightGrams',
      type: 'number',
      admin: {
        description: 'Parcel weight for the courier docket.',
        // Hidden rather than removed: dropping the field would drop the column,
        // and every existing order carries a weight that the courier docket
        // was based on.
        hidden: true,
        readOnly: true,
      },
      label: 'Parcel weight (g)',
    },
    /*
     * List columns, read off the shipping address rather than stored again, so
     * they cannot drift from it and no migration is needed.
     */
    {
      name: 'customerName',
      type: 'text',
      admin: { description: 'From the delivery address.', readOnly: true },
      hooks: {
        afterRead: [
          ({ data }) =>
            [data?.shippingAddress?.firstName, data?.shippingAddress?.lastName]
              .filter(Boolean)
              .join(' ') || null,
        ],
      },
      label: 'Name',
      virtual: true,
    },
    {
      name: 'customerPhone',
      type: 'text',
      admin: { description: 'From the delivery address.', readOnly: true },
      hooks: { afterRead: [({ data }) => data?.shippingAddress?.phone ?? null] },
      label: 'Mobile',
      virtual: true,
    },
    {
      name: 'deliveryAddress',
      type: 'text',
      admin: { description: 'From the delivery address.', readOnly: true },
      hooks: {
        afterRead: [
          ({ data }) =>
            [data?.shippingAddress?.addressLine1, data?.shippingAddress?.addressLine2]
              .filter(Boolean)
              .join(', ') || null,
        ],
      },
      label: 'Address',
      virtual: true,
    },
    {
      name: 'orderTotal',
      type: 'text',
      admin: { description: 'Amount to collect on delivery.', readOnly: true },
      hooks: {
        afterRead: [
          ({ data }) =>
            // Stored in poisha; staff read taka.
            typeof data?.amount === 'number'
              ? `৳${(data.amount / 100).toLocaleString('en-BD')}`
              : null,
        ],
      },
      label: 'Total',
      virtual: true,
    },
  ],
})
