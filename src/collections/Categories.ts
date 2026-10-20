import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access'
import { slugField } from '../fields/slugField'

/**
 * Catalog taxonomy, e.g. Cookware > Frying Pans. `parent` is a self-relation so
 * the tree can be as deep as the shop needs without a schema change.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: () => true,
    update: isAdmin,
  },
  admin: {
    defaultColumns: ['title', 'parent', 'slug'],
    description:
      'The menu order is set under Storefront → Navigation, where it can be arranged and then saved.',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField(),
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'parent',
      type: 'relationship',
      admin: {
        description: 'Leave empty for a top-level category.',
        position: 'sidebar',
      },
      // Prevents a category being made its own parent. Deeper cycles are still
      // possible but require deliberate effort in the admin panel.
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
      relationTo: 'categories',
    },
  ],
}
