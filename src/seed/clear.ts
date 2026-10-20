import type { Payload } from 'payload'

import { getPayload } from 'payload'

import config from '../payload.config'
import { CATEGORIES, imageName, PRODUCTS, VARIANT_TYPES } from './data'

/**
 * Removes everything `npm run seed` installed, and nothing else.
 *
 * Targeting is by the identifiers in ./data.ts — demo slugs, demo variant type
 * names, and media whose filename carries the `demo-` prefix. A product you
 * added yourself in the admin panel is never touched, because its slug is not
 * in that list.
 *
 * Deliberately refuses to run if any order references a demo product: deleting
 * a product out from under a real order would leave the order unreadable. Real
 * orders should never exist against demo data, so this is a safety net for the
 * case where someone has been testing checkout.
 *
 *   npm run seed:clear
 */

const clear = async (payload: Payload): Promise<void> => {
  payload.logger.info('Removing Brownmoor demo data…')

  const demoSlugs = PRODUCTS.map((p) => p.slug)

  const { docs: products } = await payload.find({
    collection: 'products',
    depth: 0,
    limit: 500,
    where: { slug: { in: demoSlugs } },
  })

  if (products.length === 0) {
    payload.logger.info('  no demo products found')
  }

  const productIds = products.map((p) => p.id)

  // ------------------------------------------------------------ safety check
  if (productIds.length > 0) {
    const { totalDocs: orderCount } = await payload.find({
      collection: 'orders',
      depth: 0,
      limit: 1,
      where: { 'items.product': { in: productIds } },
    })

    if (orderCount > 0) {
      throw new Error(
        `${orderCount} order(s) reference demo products. Refusing to delete — ` +
          'remove those orders first, or keep the demo data.',
      )
    }
  }

  // --------------------------------------------------------------- variants
  // Before products: a variant without its product is an orphan row.
  if (productIds.length > 0) {
    const { docs: variants } = await payload.find({
      collection: 'variants',
      depth: 0,
      limit: 500,
      where: { product: { in: productIds } },
    })

    for (const variant of variants) {
      await payload.delete({ collection: 'variants', id: variant.id })
    }

    payload.logger.info(`  variants removed: ${variants.length}`)
  }

  // --------------------------------------------------------------- products
  for (const product of products) {
    await payload.delete({ collection: 'products', id: product.id })
  }

  payload.logger.info(`  products removed: ${products.length}`)

  // --------------------------------------------------------------- home page
  // Reset before deleting media, so the global never points at a missing file.
  await payload.updateGlobal({
    slug: 'home-page',
    data: {
      ctaLabel: null,
      ctaLink: null,
      heading: null,
      image: null,
      // Product bands reference demo products, so they have to go with them —
      // leaving them would point the homepage at deleted rows.
      sections: [],
      subheading: null,
    },
  })

  payload.logger.info('  home page: reset')

  // ------------------------------------------------------------------ media
  const demoFilenames = [...PRODUCTS.map((p) => imageName(p.slug)), imageName('hero-banner')]

  const { docs: media } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 500,
    where: { filename: { in: demoFilenames } },
  })

  for (const item of media) {
    await payload.delete({ collection: 'media', id: item.id })
  }

  payload.logger.info(`  media removed: ${media.length}`)

  // -------------------------------------------------- variant types & options
  for (const type of VARIANT_TYPES) {
    const { docs: types } = await payload.find({
      collection: 'variantTypes',
      depth: 0,
      limit: 10,
      where: { name: { equals: type.name } },
    })

    for (const variantType of types) {
      const { docs: options } = await payload.find({
        collection: 'variantOptions',
        depth: 0,
        limit: 100,
        where: { variantType: { equals: variantType.id } },
      })

      for (const option of options) {
        await payload.delete({ collection: 'variantOptions', id: option.id })
      }

      await payload.delete({ collection: 'variantTypes', id: variantType.id })
    }
  }

  payload.logger.info(`  variant types removed: ${VARIANT_TYPES.length}`)

  // ------------------------------------------------------------- categories
  // Children first, so a parent is never deleted while something points at it.
  const ordered = [...CATEGORIES].sort((a, b) => Number(!!b.parent) - Number(!!a.parent))
  let removed = 0

  for (const spec of ordered) {
    const { docs } = await payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1,
      where: { slug: { equals: spec.slug } },
    })

    for (const category of docs) {
      await payload.delete({ collection: 'categories', id: category.id })
      removed += 1
    }
  }

  payload.logger.info(`  categories removed: ${removed}`)
  payload.logger.info('Demo data removed. Reinstall with: npm run seed')
}

const payload = await getPayload({ config })
await clear(payload)
process.exit(0)
