import type { Payload } from 'payload'

import type { Product, ShippingSetting, Variant } from '../payload-types'

/**
 * Delivery pricing.
 *
 * Rates, zones and weight allowances all come from the Shipping Settings
 * global, so changing what the courier charges is an admin edit rather than a
 * deploy. Nothing here hardcodes a number.
 *
 * All money is in poisha, matching every other amount in the system.
 */

export type ShippingLine = {
  product: number | Product
  quantity: number
  variant?: null | number | Variant
}

export type ShippingQuote = {
  /** Delivery charge in poisha. */
  amount: number
  /** True when the subtotal cleared the free-shipping threshold. */
  isFree: boolean
  /** Human-readable zone name, stored on the order for the courier. */
  zoneLabel: string
  /** Total parcel weight in grams, for the courier docket. */
  totalWeightGrams: number
}

type Zone = NonNullable<ShippingSetting['zones']>[number]

/**
 * First zone whose city list contains the delivery city wins; otherwise the
 * zone flagged `isDefault`.
 *
 * Falling back to the default rather than the cheapest matters: an unrecognised
 * city is far more likely to be outside Dhaka than inside it, and quoting the
 * inside-Dhaka rate for a district delivery means eating the difference on
 * every such order.
 */
export const resolveZone = (zones: Zone[], city: null | string | undefined): undefined | Zone => {
  const normalised = (city || '').trim().toLowerCase()

  if (normalised) {
    const matched = zones.find((zone) =>
      (zone.cities || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .includes(normalised),
    )

    if (matched) {
      return matched
    }
  }

  return zones.find((zone) => zone.isDefault) ?? zones[0]
}

/**
 * Weight of one line, preferring the variant's own weight — a 24cm pan and a
 * 16cm pan of the same product do not weigh the same.
 */
const lineWeight = (line: ShippingLine, fallbackGrams: number): number => {
  const variant = typeof line.variant === 'object' ? line.variant : null
  const product = typeof line.product === 'object' ? line.product : null

  const grams =
    (typeof variant?.weightGrams === 'number' ? variant.weightGrams : null) ??
    (typeof product?.weightGrams === 'number' ? product.weightGrams : null) ??
    fallbackGrams

  return grams * (line.quantity || 0)
}

export const quoteShipping = async ({
  city,
  items,
  payload,
  subtotal,
}: {
  city: null | string | undefined
  items: ShippingLine[]
  payload: Payload
  /** Order subtotal in poisha, used for the free-shipping threshold. */
  subtotal: number
}): Promise<ShippingQuote> => {
  const settings = (await payload.findGlobal({ slug: 'shipping-settings' })) as ShippingSetting

  const zones = settings?.zones ?? []
  const fallbackGrams = settings?.defaultItemWeightGrams ?? 500
  const zone = resolveZone(zones, city)

  const totalWeightGrams = items.reduce((total, line) => total + lineWeight(line, fallbackGrams), 0)

  if (!zone) {
    // No zones configured at all. Charging nothing is wrong, but so is
    // inventing a rate — surface it rather than silently shipping free.
    throw new Error('No shipping zones are configured. Set them in Shipping Settings.')
  }

  // Threshold is entered in whole Taka for admin convenience; convert to poisha.
  const threshold =
    typeof settings.freeShippingThreshold === 'number' && settings.freeShippingThreshold > 0
      ? settings.freeShippingThreshold * 100
      : null

  if (threshold !== null && subtotal >= threshold) {
    return { amount: 0, isFree: true, totalWeightGrams, zoneLabel: zone.label }
  }

  const allowance = zone.includedWeightGrams ?? 0
  const excess = Math.max(0, totalWeightGrams - allowance)

  // Couriers bill per started kilogram, not pro rata — 1.2 kg over costs the
  // same as 2 kg over.
  const extraKg = Math.ceil(excess / 1000)
  const surcharge = extraKg * (zone.surchargePerKg ?? 0)

  return {
    amount: zone.baseRate + surcharge,
    isFree: false,
    totalWeightGrams,
    zoneLabel: zone.label,
  }
}
