import type { Payload } from 'payload'

import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../payload.config'
import { CATEGORIES, HOME_PAGE, HOME_SECTIONS, imageName, PRODUCTS, VARIANT_TYPES } from './data'

/**
 * Installs the demo catalogue defined in ./data.ts.
 *
 * Safe to re-run: every record is looked up by a stable identifier first and
 * skipped if present, so this never duplicates. Remove everything it made with
 * `npm run seed:clear`.
 *
 *   npm run seed
 */

const taka = (amount: number): number => Math.round(amount * 100)

const placeholder = async (
  label: string,
  background: string,
  width: number,
  height: number,
): Promise<Buffer> => {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fontSize = Math.round(width / 22)

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${background}"/>
      <text x="${width / 2}" y="${height / 2 + fontSize / 3}" font-family="Georgia, serif"
            font-size="${fontSize}" fill="#ffffff" fill-opacity="0.82"
            text-anchor="middle">${escaped}</text>
    </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

const uploadImage = async (
  payload: Payload,
  slug: string,
  label: string,
  colour: string,
  width = 1200,
  height = 1200,
) => {
  const data = await placeholder(label, colour, width, height)

  return payload.create({
    collection: 'media',
    data: { alt: label },
    file: { data, mimetype: 'image/png', name: imageName(slug), size: data.length },
  })
}

const findOne = async (
  payload: Payload,
  collection: 'categories' | 'products' | 'variantOptions' | 'variants' | 'variantTypes',
  where: Record<string, unknown>,
) => {
  const { docs } = await payload.find({ collection, depth: 0, limit: 1, where: where as never })
  return docs[0]
}

const seed = async (payload: Payload): Promise<void> => {
  payload.logger.info('Installing Brownmoor demo data…')

  // ---------------------------------------------------------------- categories
  const categoryIds: Record<string, number> = {}

  // Parents first, so a child always has something to point at.
  for (const spec of [...CATEGORIES].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))) {
    const existing = await findOne(payload, 'categories', { slug: { equals: spec.slug } })

    if (existing) {
      categoryIds[spec.slug] = existing.id as number
      continue
    }

    const created = await payload.create({
      collection: 'categories',
      data: {
        slug: spec.slug,
        title: spec.title,
        ...(spec.parent ? { parent: categoryIds[spec.parent] } : {}),
      },
    })

    categoryIds[spec.slug] = created.id
  }

  payload.logger.info(`  categories: ${Object.keys(categoryIds).length}`)

  // ------------------------------------------------------------- variant types
  const optionIds: Record<string, Record<string, number>> = {}
  const typeIds: Record<string, number> = {}

  for (const type of VARIANT_TYPES) {
    let variantType = await findOne(payload, 'variantTypes', { name: { equals: type.name } })

    if (!variantType) {
      variantType = await payload.create({
        collection: 'variantTypes',
        data: { label: type.label, name: type.name },
      })
    }

    typeIds[type.name] = variantType.id as number
    optionIds[type.name] = {}

    for (const value of type.options) {
      let option = await findOne(payload, 'variantOptions', {
        and: [{ value: { equals: value } }, { variantType: { equals: variantType.id } }],
      })

      if (!option) {
        option = await payload.create({
          collection: 'variantOptions',
          data: { label: value, value, variantType: variantType.id as number },
        })
      }

      optionIds[type.name][value] = option.id as number
    }
  }

  payload.logger.info(`  variant types: ${VARIANT_TYPES.length}`)

  // ------------------------------------------------------------------ products
  let created = 0
  let variantsCreated = 0

  for (const spec of PRODUCTS) {
    const hasVariants = Boolean(spec.variants?.length && spec.variantType)
    let product = await findOne(payload, 'products', { slug: { equals: spec.slug } })

    if (!product) {
      const image = await uploadImage(payload, spec.slug, spec.title, spec.colour)

      product = await payload.create({
        collection: 'products',
        data: {
          _status: 'published',
          ...(spec.care ? { careInstructions: spec.care } : {}),
          categories: spec.categories.map((slug) => categoryIds[slug]).filter(Boolean),
          featured: Boolean(spec.featured),
          gallery: [{ image: image.id }],
          shortDescription: spec.shortDescription,
          slug: spec.slug,
          specifications: spec.specs,
          title: spec.title,
          ...(hasVariants
            ? { enableVariants: true, variantTypes: [typeIds[spec.variantType!]] }
            : {
                inventory: spec.stock ?? 0,
                priceInBDT: taka(spec.price ?? 0),
                priceInBDTEnabled: true,
                ...(spec.compareAt ? { compareAtPriceInBDT: taka(spec.compareAt) } : {}),
                ...(spec.weight ? { weightGrams: spec.weight } : {}),
              }),
        },
      })

      created += 1
      payload.logger.info(`  product: ${spec.title}`)
    }

    // Outside the block above on purpose. Creating variants only when the
    // product is new meant that a run interrupted between the two left the
    // product permanently variant-less — it looks sold out, and no later run
    // would ever repair it because the product now "exists".
    if (!hasVariants) {
      continue
    }

    for (const variant of spec.variants!) {
      const optionId = optionIds[spec.variantType!][variant.option]

      const existing = await findOne(payload, 'variants', {
        and: [{ product: { equals: product.id } }, { options: { in: [optionId] } }],
      })

      if (existing) {
        continue
      }

      await payload.create({
        collection: 'variants',
        data: {
          _status: 'published',
          inventory: variant.stock,
          // What the shopper picks. The shop-wide option is still written so the
          // demo data exercises both shapes, but the label is what renders.
          label: variant.option,
          options: [optionId],
          priceInBDT: taka(variant.price),
          priceInBDTEnabled: true,
          product: product.id,
          title: `${spec.title} — ${variant.option}`,
          weightGrams: variant.weight,
          ...(variant.compareAt ? { compareAtPriceInBDT: taka(variant.compareAt) } : {}),
        },
      })

      variantsCreated += 1
      payload.logger.info(`    variant: ${spec.title} — ${variant.option}`)
    }
  }

  payload.logger.info(
    `  products created: ${created} (${PRODUCTS.length - created} already present), variants created: ${variantsCreated}`,
  )

  // ----------------------------------------------------------------- home page
  // Hero and sections are guarded separately. Sharing one condition meant that
  // if a run was interrupted after the hero was set but before the sections
  // were, no later run would ever fill the sections in.
  const home = await payload.findGlobal({ slug: 'home-page' })
  const needsHero = !home?.image
  const needsSections = !home?.sections || home.sections.length === 0

  if (needsHero || needsSections) {
    const update: Record<string, unknown> = {}

    if (needsHero) {
      const banner = await uploadImage(
        payload,
        'hero-banner',
        'Brownmoor.com',
        HOME_PAGE.heroColour,
        2400,
        1000,
      )

      update.ctaLabel = HOME_PAGE.ctaLabel
      update.ctaLink = HOME_PAGE.ctaLink
      update.heading = HOME_PAGE.heading
      update.image = banner.id
      update.subheading = HOME_PAGE.subheading
    }

    if (needsSections) {
      // Slugs are resolved to ids here, so the sections survive a re-seed
      // handing out different ids. A slug that no longer resolves is skipped.
      const idBySlug = new Map<string, number>()
      const { docs: allProducts } = await payload.find({
        collection: 'products',
        depth: 0,
        limit: 500,
      })

      for (const product of allProducts) {
        idBySlug.set(product.slug, product.id)
      }

      update.sections = HOME_SECTIONS.map((section) => ({
        eyebrow: section.eyebrow,
        heading: section.heading,
        intro: section.intro,
        products: section.products
          .map((slug) => idBySlug.get(slug))
          .filter((id): id is number => typeof id === 'number'),
        viewAllLabel: section.viewAllLabel,
        viewAllUrl: section.viewAllUrl,
      }))
    }

    await payload.updateGlobal({ slug: 'home-page', data: update as never })

    payload.logger.info(
      `  home page: ${[needsHero && 'hero', needsSections && `${HOME_SECTIONS.length} sections`]
        .filter(Boolean)
        .join(' + ')}`,
    )
  }

  payload.logger.info('Demo data installed. Remove it with: npm run seed:clear')
}

const payload = await getPayload({ config })
await seed(payload)
process.exit(0)
