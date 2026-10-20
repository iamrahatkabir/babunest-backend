import type { Where } from 'payload'

import type { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

import type { Field } from 'payload'

import { compareAtPriceField } from '../fields/compareAtPrice'

/**
 * Reshapes the plugin's three variant fields on a product.
 *
 * Out of the box a product picks a *global* variant type before it may have any
 * variants, so "500 ml" has to be defined shop-wide before one bottle can use
 * it. Kitchenware sizes do not generalise that way — a 24cm pan and a 24cm
 * saucepan share a number and nothing else — so the type picker is hidden and
 * the variants table is shown as soon as variants are enabled.
 *
 * The table itself is the plugin's own join field: it lists this product's
 * variants and offers Create, and is empty until one exists.
 */
const withProductVariantFields = (fields: Field[]): Field[] =>
  fields.map((field) => {
    if (!('name' in field)) {
      return field
    }

    // Global types are not used; variants are created per product.
    if (field.name === 'variantTypes') {
      return { ...field, admin: { ...field.admin, hidden: true } } as Field
    }

    if (field.name === 'variants' && field.type === 'join') {
      return {
        ...field,
        admin: {
          ...field.admin,
          // Ticking the box is enough. The plugin also required a variant type,
          // which is the step being removed.
          condition: ({ enableVariants }: { enableVariants?: boolean }) => Boolean(enableVariants),
          defaultColumns: ['label', 'title', 'priceInBDT', 'inventory'],
        },
      } as Field
    }

    return field
  })

import { weightField } from '../fields/weight'
import { slugField } from '../fields/slugField'
import { pruneCartItems } from '../hooks/pruneCartItems'

/**
 * The plugin's products collection ships only the commerce machinery — prices,
 * inventory and the variants config. Everything a shopper actually reads
 * (name, photos, copy, category) is ours to add.
 *
 * The plugin's own fields are appended after these so that price and inventory
 * keep whatever behaviour the plugin gives them.
 */
export const productsCollectionOverride: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection.admin,
    defaultColumns: ['title', 'categories', 'prices', '_status'],
    useAsTitle: 'title',
  },
  hooks: {
    ...defaultCollection.hooks,
    // A product sitting in someone's cart has to be lifted out before it goes,
    // or the cart is left holding a line it can never resolve.
    beforeDelete: [...(defaultCollection.hooks?.beforeDelete ?? []), pruneCartItems],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'shortDescription',
              type: 'textarea',
              admin: {
                description: 'One or two lines for listing pages and search results.',
              },
              maxLength: 300,
            },
            {
              name: 'description',
              type: 'richText',
            },
            {
              name: 'gallery',
              type: 'array',
              admin: {
                description: 'First image is used as the product thumbnail.',
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                },
              ],
              labels: {
                plural: 'Images',
                singular: 'Image',
              },
              minRows: 1,
            },
            // The plugin's fields: prices, inventory, and the variants setup.
            ...withProductVariantFields(defaultCollection.fields),
            // Sits after the plugin's price field so the two read together in
            // the admin. Only meaningful on products without variants —
            // variants carry their own compare-at price.
            {
              ...compareAtPriceField(),
              admin: {
                ...compareAtPriceField().admin,
                condition: (data) => !data?.enableVariants,
              },
            },
          ],
          label: 'Details',
        },
        {
          fields: [
            {
              name: 'specifications',
              type: 'array',
              admin: {
                description:
                  'Kitchenware buyers compare on specifics — material, capacity, diameter, whether it is dishwasher or induction safe.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'label',
                      type: 'text',
                      admin: { width: '40%' },
                      required: true,
                    },
                    {
                      name: 'value',
                      type: 'text',
                      admin: { width: '60%' },
                      required: true,
                    },
                  ],
                },
              ],
            },
            {
              name: 'careInstructions',
              type: 'textarea',
            },
            // Only used when the product has no variants; a variant carries
            // its own weight, since sizes differ.
            {
              ...weightField(),
              admin: {
                ...weightField().admin,
                condition: (data) => !data?.enableVariants,
              },
            },
          ],
          label: 'Specifications',
        },
      ],
    },
    slugField(),
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        position: 'sidebar',
      },
      hasMany: true,
      relationTo: 'categories',
    },
    {
      name: 'featured',
      type: 'checkbox',
      admin: {
        description: 'Surface this product on the homepage.',
        position: 'sidebar',
      },
    },
    {
      name: 'relatedProducts',
      type: 'relationship',
      admin: {
        description:
          'Shown at the bottom of this product page, in this order. Leave empty and products from the same category are suggested instead.',
      },
      filterOptions: ({ id }): Where => {
        // A draft would 404 for shoppers; a product should not recommend itself.
        const and: Where[] = [{ _status: { equals: 'published' } }]

        if (id) {
          and.push({ id: { not_equals: id } })
        }

        return { and }
      },
      hasMany: true,
      relationTo: 'products',
    },
  ],
})
