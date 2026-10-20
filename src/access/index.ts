import type { Access, FieldAccess, PayloadRequest } from 'payload'

import type { User } from '../payload-types'

/**
 * Roles live on the `users` collection. Admins run the shop from the Payload
 * admin panel; customers are the same collection, so a shopper's login and an
 * order's owner are the same record.
 */
export type Role = 'admin' | 'customer'

/**
 * `req.user` is typed loosely in access functions because any auth-enabled
 * collection could be the one logged in. Narrowing here keeps the call sites
 * readable.
 */
const hasRole = (user: unknown, role: Role): boolean => {
  const roles = (user as null | Partial<User>)?.roles
  return Array.isArray(roles) && roles.includes(role)
}

export const isAdmin: Access = ({ req }) => hasRole(req.user, 'admin')

export const isAdminFieldLevel: FieldAccess = ({ req }) => hasRole(req.user, 'admin')

/**
 * Controls who may open the admin panel at all. Kept separate from `isAdmin`
 * because this one must return a plain boolean — a `Where` constraint is
 * meaningless when the question is "render the admin UI or not".
 */
export const isAdminPanelUser = ({ req }: { req: PayloadRequest }): boolean =>
  hasRole(req.user, 'admin')

export const isAuthenticated: Access = ({ req }) => Boolean(req.user)

/**
 * A customer is any authenticated user who is not an admin. The plugin uses
 * this to decide when to auto-assign `customer` on newly created addresses,
 * so it must not be true for admins acting on someone else's behalf.
 */
export const isCustomerFieldLevel: FieldAccess = ({ req }) =>
  Boolean(req.user) && !hasRole(req.user, 'admin')

/**
 * Returns a `Where` constraint rather than a boolean so that a customer listing
 * e.g. /api/orders sees their own rows only, instead of receiving a 403.
 */
export const isDocumentOwner: Access = ({ req }) => {
  if (!req.user) {
    return false
  }

  if (hasRole(req.user, 'admin')) {
    return true
  }

  return {
    customer: {
      equals: req.user.id,
    },
  }
}

/**
 * Ownership on the users collection itself.
 *
 * `isDocumentOwner` constrains on a `customer` field, which is right for
 * orders, carts and addresses but does not exist on `users` — a user *is* the
 * customer. Filtering on it there makes Postgres error on an unknown column,
 * so a signed-in shopper hitting /api/users got a 500 instead of their own
 * record.
 */
export const isSelfOrAdmin: Access = ({ req }) => {
  if (!req.user) {
    return false
  }

  if (hasRole(req.user, 'admin')) {
    return true
  }

  return {
    id: {
      equals: req.user.id,
    },
  }
}

export const publicAccess: Access = () => true

/**
 * Guards drafts: the storefront may read published products, while admins see
 * everything including work in progress.
 */
export const adminOrPublishedStatus: Access = ({ req }) => {
  if (hasRole(req.user, 'admin')) {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}

/**
 * Admins may always act. Everyone else is limited to documents they own.
 * Used for collections where a customer needs write access to their own rows
 * (addresses, carts) but must never touch another customer's.
 */
export const isAdminOrDocumentOwner: Access = (args) => {
  if (hasRole(args.req.user, 'admin')) {
    return true
  }

  return isDocumentOwner(args)
}
