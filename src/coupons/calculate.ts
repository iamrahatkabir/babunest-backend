import type { Payload } from 'payload'

import type { Coupon } from '../payload-types'

/**
 * Works out what a code is worth, and whether it may be used at all.
 *
 * Deliberately the single place this is decided. The checkout page calls it
 * through /api/coupons/validate to show the shopper a figure, and the payment
 * adapter calls it again when the order is confirmed. If the two ever disagreed,
 * the quoted saving and the charged saving would differ — which on cash on
 * delivery is an argument at the door.
 *
 * All amounts are in poisha.
 */

export type CouponResult =
  | { discount: number; coupon: Coupon; valid: true }
  | { reason: string; valid: false }

/**
 * Shown to shoppers on the checkout page, which is in English — unlike the
 * policy pages. They say what is wrong rather than merely that something is.
 */
const REASONS = {
  expired: 'This coupon has expired.',
  /**
   * Names the figure rather than merely saying the order is too small. A
   * shopper who is told "minimum order is BDT 5,000" can decide whether to add
   * something; "your order is not large enough" leaves them guessing by how
   * much, which usually means abandoning the code.
   */
  minimum: (amountInPoisha: number) =>
    `Minimum order amount is ৳${(amountInPoisha / 100).toLocaleString('en-BD')}.`,
  notFound: "That coupon code isn't valid.",
  notStarted: 'This coupon is not active yet.',
  usedUp: 'This coupon has already been fully used.',
} as const

export const resolveCoupon = async ({
  code,
  payload,
  subtotal,
}: {
  code: string
  payload: Payload
  /** Goods total in poisha, before delivery. */
  subtotal: number
}): Promise<CouponResult> => {
  const normalised = code.trim().toUpperCase()

  if (!normalised) {
    return { reason: REASONS.notFound, valid: false }
  }

  // overrideAccess because the collection is admin-only: the shopper is asking
  // about one code they already know, not browsing the list.
  const { docs } = await payload.find({
    collection: 'coupons',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { code: { equals: normalised } },
  })

  const coupon = docs[0] as Coupon | undefined

  // An inactive code is indistinguishable from a wrong one on purpose: saying
  // "that code is switched off" confirms it exists and invites guessing.
  if (!coupon || !coupon.active) {
    return { reason: REASONS.notFound, valid: false }
  }

  const now = Date.now()

  if (coupon.startsAt && now < new Date(coupon.startsAt).getTime()) {
    return { reason: REASONS.notStarted, valid: false }
  }

  if (coupon.expiresAt && now > new Date(coupon.expiresAt).getTime()) {
    return { reason: REASONS.expired, valid: false }
  }

  if (typeof coupon.usageLimit === 'number' && (coupon.usageCount ?? 0) >= coupon.usageLimit) {
    return { reason: REASONS.usedUp, valid: false }
  }

  if (typeof coupon.minOrderAmount === 'number' && subtotal < coupon.minOrderAmount) {
    return { reason: REASONS.minimum(coupon.minOrderAmount), valid: false }
  }

  let discount = 0

  if (coupon.discountType === 'percentage' && typeof coupon.percentage === 'number') {
    discount = Math.round((subtotal * coupon.percentage) / 100)

    if (typeof coupon.maxDiscount === 'number' && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount)
    }
  }

  if (coupon.discountType === 'fixed' && typeof coupon.fixedAmount === 'number') {
    discount = coupon.fixedAmount
  }

  // Never more than the goods are worth: a discount larger than the subtotal
  // would otherwise eat into the delivery charge, or make the total negative.
  discount = Math.max(0, Math.min(discount, subtotal))

  if (discount === 0) {
    return { reason: REASONS.notFound, valid: false }
  }

  return { coupon, discount, valid: true }
}
