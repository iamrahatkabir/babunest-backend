import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access'

/**
 * The order categories appear in the menu.
 *
 * A global rather than drag handles on the Categories list because those commit
 * the moment a row is dropped, with no chance to look at the result and change
 * your mind. Ordering here is an ordinary edit: drag, look, then Save — or
 * leave without saving and nothing changed.
 *
 * Only the order lives here. The categories themselves, their names, images and
 * parents, stay on the Categories collection; this is a list of references.
 */
export const Navigation: GlobalConfig = {
  slug: 'navigation',
  access: {
    // Public: the storefront reads it unauthenticated on every render.
    read: () => true,
    update: isAdmin,
  },
  admin: {
    group: 'Storefront',
  },
  fields: [
    {
      name: 'menu',
      type: 'relationship',
      admin: {
        description:
          'Drag to set the order of the menu, then press Save. Include child categories too — a child orders within its parent\'s dropdown. Anything left out still appears, after the categories listed here, in alphabetical order.',
      },
      hasMany: true,
      label: 'Menu order',
      relationTo: 'categories',
    },
  ],
  label: 'Navigation',
}
