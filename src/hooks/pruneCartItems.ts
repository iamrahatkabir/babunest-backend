import type { CollectionBeforeDeleteHook } from 'payload'

/**
 * Takes a product out of every cart before the product itself is deleted.
 *
 * Without this, deleting a product leaves the cart lines behind with an empty
 * product, because the foreign key is ON DELETE SET NULL. A shopper holding one
 * of those lines is stuck for good: the header still counts it, the cart page
 * cannot draw it, and every write to the cart throws on the missing product —
 * so they cannot add, remove, or check out, and see no error explaining why.
 *
 * It has to be `beforeDelete`. By the time an afterDelete hook runs the column
 * is already NULL, and there is no longer anything to match the product on.
 *
 * Lines whose product is already missing are dropped in the same pass, so a
 * cart damaged before this hook existed repairs itself the next time any
 * product in it is deleted.
 */
export const pruneCartItems: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { payload } = req

  const { docs: carts } = await payload.find({
    collection: 'carts',
    depth: 0,
    limit: 1000,
    // Only carts still in play; a purchased cart is a historical record.
    where: {
      and: [{ 'items.product': { equals: id } }, { purchasedAt: { exists: false } }],
    },
    req,
  })

  for (const cart of carts) {
    const items = (cart.items ?? []).filter(
      (item) => item.product !== null && item.product !== undefined && item.product !== id,
    )

    await payload.update({
      collection: 'carts',
      id: cart.id,
      data: { items },
      req,
    })
  }

  if (carts.length > 0) {
    payload.logger.info(
      `Removed product ${id} from ${carts.length} active cart(s) before deleting it.`,
    )
  }
}
