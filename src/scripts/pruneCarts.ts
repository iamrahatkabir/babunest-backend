import type { Payload } from 'payload'

import { getPayload } from 'payload'

import config from '../payload.config'

/**
 * Removes cart lines whose product no longer exists.
 *
 * Deleting a product does not delete the cart rows pointing at it — the foreign
 * key is ON DELETE SET NULL, so the line survives with an empty product. The
 * shopper is then stuck: the header counts the line, the cart page cannot draw
 * it, and every write to that cart throws, so they can neither add nor remove
 * anything.
 *
 * Cleaning up in raw SQL rather than through the Payload API is deliberate.
 * Updating one of these carts is exactly the operation that crashes, so the API
 * cannot be used to repair the damage it reports.
 *
 * Prints what it would remove and changes nothing:
 *   npm run carts:prune
 *
 * Actually removes them:
 *   npm run carts:prune -- --apply
 *
 * The `hooks/pruneCartItems` beforeDelete hook stops new orphans appearing, so
 * this is for rows left behind before that hook existed.
 */

type Pool = { query: (text: string) => Promise<{ rows: Record<string, unknown>[] }> }

const prune = async (payload: Payload, apply: boolean): Promise<void> => {
  const pool = (payload.db as unknown as { pool: Pool }).pool

  const { rows } = await pool.query(`
    SELECT ci._parent_id AS cart_id, COUNT(*)::int AS orphaned
    FROM carts_items ci
    WHERE ci.product_id IS NULL
    GROUP BY ci._parent_id
    ORDER BY ci._parent_id
  `)

  if (rows.length === 0) {
    payload.logger.info('No orphaned cart lines. Nothing to do.')
    return
  }

  const total = rows.reduce((sum, row) => sum + Number(row.orphaned), 0)

  payload.logger.info(
    `Found ${total} orphaned cart line(s) across ${rows.length} cart(s):`,
  )

  for (const row of rows) {
    payload.logger.info(`  cart ${row.cart_id}: ${row.orphaned} line(s)`)
  }

  if (!apply) {
    payload.logger.info('Dry run — nothing removed. Re-run with --apply to remove them.')
    return
  }

  const { rows: deleted } = await pool.query(`
    DELETE FROM carts_items WHERE product_id IS NULL RETURNING id
  `)

  payload.logger.info(`Removed ${deleted.length} orphaned cart line(s).`)
}

const payload = await getPayload({ config })
await prune(payload, process.argv.includes('--apply'))
process.exit(0)
