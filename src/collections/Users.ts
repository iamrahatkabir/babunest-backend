import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel, isAdminPanelUser, isSelfOrAdmin } from '../access'

/**
 * Both shop staff and shoppers live here. The ecommerce plugin is pointed at
 * this collection as its `customers`, so carts, orders and addresses relate
 * straight to a user record.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: isAdminPanelUser,
    // Open so the storefront can register shoppers. The `roles` field below is
    // locked down separately, so a self-registering user cannot make
    // themselves an admin.
    create: () => true,
    delete: isAdmin,
    read: isSelfOrAdmin,
    update: isSelfOrAdmin,
  },
  admin: {
    defaultColumns: ['email', 'name', 'roles'],
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [
          async ({ operation, req, value }) => {
            if (operation !== 'create') {
              return value
            }

            // The very first user is created through the admin panel's
            // create-first-user screen, where nobody is logged in yet and so
            // field-level access has stripped `roles`. Without this they would
            // be locked out of their own admin panel.
            const { totalDocs } = await req.payload.count({
              collection: 'users',
              req,
            })

            if (totalDocs === 0) {
              return ['admin']
            }

            // Field access strips `roles` from a self-registering shopper's
            // request, which would otherwise fail the `required` check below.
            if (!Array.isArray(value) || value.length === 0) {
              return ['customer']
            }

            return value
          },
        ],
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Customer', value: 'customer' },
      ],
      required: true,
    },
  ],
}
