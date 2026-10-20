import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import type { Field } from 'payload'

import { compareAtPriceField } from '../fields/compareAtPrice'
import { weightField } from '../fields/weight'

/**
 * The three collections behind product options, gathered into one sidebar
 * section.
 *
 * The plugin ships them ungrouped, so they sit loose in the nav between the
 * shop's own collections and are easy to miss. A size added to the wrong type,
 * or a stray option nobody uses, is hard to spot when the three are scattered.
 *
 * Nothing else changes: each is an ordinary collection, so listing, creating
 * and deleting all work as they already did.
 */
/**
 * Kept out of the sidebar. Variants belong to a product and are built on the
 * product's own page, so a top-level entry for them is a way to edit a size
 * with no sight of what it is a size of. The collections still exist and still
 * work; they are simply not somewhere to browse.
 */
const HIDE_FROM_NAV = true

/**
 * One buyable combination of a product and its options, with its own price.
 *
 * This is where variant-wise pricing lives: a 24cm pan and a 28cm pan are two
 * variants of one product at two prices, each with its own stock and weight, so
 * a sale on one size but not another is expressible and the courier gets the
 * right parcel weight.
 *
 * Built from the product's own page rather than here, which is why the
 * collection is out of the nav — a variant with no sight of its product is
 * meaningless.
 */
/** What the shopper picks. Defined here so it can be slotted in after Title. */
const labelField: Field = {
  name: 'label',
  type: 'text',
  admin: {
    description:
      'What the customer sees and picks — "500 ml", "1 litre", "24cm". This is the variant, as far as the shop is concerned.',
  },
  required: true,
}

export const variantsCollectionOverride: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection.admin,
    // Which product a variant belongs to is the first thing you need when
    // reading a list of them; on its own, "20cm" says nothing.
    defaultColumns: ['label', 'title', 'product', 'priceInBDT', 'inventory'],
    description:
      'A product in one specific option, priced on its own. Created from the product page — enable variants there and a row appears for each option.',
    hidden: HIDE_FROM_NAV,
  },
  fields: [
    /*
     * Label sits directly after Title, because the two are read together: the
     * title identifies the row for staff and the label is what the shopper
     * picks. Appending it after the price fields, as the plugin's own field
     * order would, split that pair across the form.
     */
    ...defaultCollection.fields.flatMap((field): Field[] => {
      // The plugin builds a variant out of shop-wide options. Those are not
      // used here, so the field is optional and hidden rather than deleted:
      // dropping it would drop the join table, and an existing variant may
      // still point at an option row.
      if ('name' in field && field.name === 'options') {
        return [
          {
            ...field,
            admin: { ...field.admin, hidden: true },
            required: false,
            // The plugin attaches its own validator insisting on at least one
            // option, and that runs whatever `required` says. Clearing
            // `required` alone left every save failing on a field the panel
            // does not show. Options are unused, so there is nothing to check.
            validate: () => true,
          } as Field,
        ]
      }

      if ('name' in field && field.name === 'title') {
        return [field, labelField]
      }

      return [field]
    }),
    compareAtPriceField(),
    weightField(),
  ],
})

/**
 * The axis a customer chooses along — Size, Capacity, Colour.
 *
 * Not the values themselves. One type covers a whole range: "Capacity" with
 * 500 ml and 1000 ml beneath it, not a separate type per size.
 */
export const variantTypesCollectionOverride: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection.admin,
    defaultColumns: ['label', 'name'],
    description:
      'The kind of choice a customer makes, not the choices themselves. Create one per range — Size, Capacity, Colour — then add its values under Variant Options. A 500 ml and a 1 litre bottle are two options of one Capacity type, not two types.',
    hidden: HIDE_FROM_NAV,
  },
  fields: defaultCollection.fields.map((field: Field) => {
    if ('name' in field && field.name === 'label') {
      return {
        ...field,
        admin: { ...field.admin, description: 'Shown to the customer above the choices, e.g. "Capacity".' },
      } as Field
    }

    if ('name' in field && field.name === 'name') {
      return {
        ...field,
        admin: { ...field.admin, description: 'Internal identifier, lower case and no spaces, e.g. "capacity".' },
      } as Field
    }

    return field
  }),
})

/**
 * The values on a type's axis — 500 ml and 1000 ml under Capacity.
 *
 * These are what a customer picks between. Pricing does not live here: an
 * option is the same "500 ml" wherever it is used, and what a particular
 * product charges for it belongs on the variant.
 */
export const variantOptionsCollectionOverride: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection.admin,
    description:
      'One value a customer can pick, belonging to a type — "500 ml" under Capacity, "24cm" under Size. Price and stock are set per product, on the variant, not here.',
    // Without its type, a list of bare labels gives no way to tell which
    // "Small" belongs to which option.
    defaultColumns: ['label', 'value', 'variantType'],
    hidden: HIDE_FROM_NAV,
  },
})
