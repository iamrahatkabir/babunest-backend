import type { CollectionSlug, GroupField } from 'payload'

import type {
  PaymentAdapter,
  PaymentAdapterClient,
  PaymentAdapterClientArgs,
  PaymentAdapterArgs,
} from '@payloadcms/plugin-ecommerce/types'

import { randomBytes } from 'crypto'

import type { Order, Transaction } from '../payload-types'
import type { ShippingLine } from '../shipping/calculate'

import { resolveCoupon } from '../coupons/calculate'
import { quoteShipping } from '../shipping/calculate'

/**
 * Cash on delivery.
 *
 * There is no gateway to call, so this adapter is bookkeeping rather than
 * payment processing. `initiatePayment` records the intent to buy and
 * `confirmOrder` turns it into a real order — but the transaction deliberately
 * stays `pending`, because no money has changed hands until the courier
 * collects it. Staff flip the transaction to `succeeded` in the admin panel
 * once the cash is in.
 *
 * Modelled on the plugin's Stripe adapter, minus the network calls. Where
 * Stripe stashes the cart snapshot in PaymentIntent metadata, we keep it on the
 * transaction itself, which is the only durable store we have here.
 */

/** Ties the initiate step to the confirm step in place of a PaymentIntent ID. */
const generateReference = (): string => `cod_${randomBytes(16).toString('hex')}`

type CartItemLike = {
  [key: string]: unknown
  product: { id: unknown } | unknown
  quantity: number
  variant?: { id: unknown } | unknown
}

type FlatCartItem = {
  product: number
  quantity: number
  variant?: number
}

/** Relationships arrive as either a bare ID or a populated doc, depending on query depth. */
const toID = (value: unknown): number => {
  const raw = value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

  return Number(raw)
}

/**
 * Orders and transactions store relationship IDs, so flatten before writing.
 * Any extra keys a custom `cartItemMatcher` added are preserved, but `id` is
 * dropped so Payload mints fresh array-row IDs rather than reusing the cart's.
 */
const flattenItems = (items: CartItemLike[]): FlatCartItem[] =>
  items.map((item) => {
    const { id: _id, product, quantity, variant, ...rest } = item

    return {
      ...rest,
      product: toID(product),
      quantity,
      ...(variant === undefined || variant === null ? {} : { variant: toID(variant) }),
    } as FlatCartItem
  })

export const cashOnDeliveryAdapter = (props?: PaymentAdapterArgs): PaymentAdapter => {
  const { groupOverrides } = props || {}
  const label = props?.label || 'Cash on Delivery'

  const baseFields: GroupField['fields'] = [
    {
      name: 'reference',
      type: 'text',
      admin: {
        description: 'Internal handle linking this transaction to its checkout attempt.',
        readOnly: true,
      },
      index: true,
      label: 'COD Reference',
    },
    {
      name: 'couponCode',
      type: 'text',
      admin: {
        description: 'Discount code entered at checkout, if any. The saving is recalculated from it when the order is confirmed.',
        readOnly: true,
      },
      label: 'Coupon code',
    },
    {
      name: 'shippingAddressSnapshot',
      type: 'json',
      admin: {
        description:
          'Where the courier should deliver, captured at checkout. Copied onto the order on confirmation.',
        readOnly: true,
      },
      label: 'Shipping Address Snapshot',
    },
  ]

  const group: GroupField = {
    name: 'cod',
    type: 'group',
    ...groupOverrides,
    admin: {
      condition: (data) => data?.paymentMethod === 'cod',
      ...groupOverrides?.admin,
    },
    fields:
      typeof groupOverrides?.fields === 'function'
        ? groupOverrides.fields({ defaultFields: baseFields })
        : baseFields,
    label: 'Cash on Delivery',
  }

  return {
    name: 'cod',
    confirmOrder: async ({
      cartsSlug = 'carts',
      data,
      ordersSlug = 'orders',
      req,
      transactionsSlug = 'transactions',
    }) => {
      const payload = req.payload
      const reference = data?.reference

      if (!reference || typeof reference !== 'string') {
        throw new Error('A cash-on-delivery reference is required to confirm this order.')
      }

      try {
        // depth 0 so `items` come back as plain IDs, ready to write onto the order.
        const transactions = await payload.find({
          collection: transactionsSlug as CollectionSlug,
          depth: 0,
          limit: 1,
          req,
          where: {
            'cod.reference': {
              equals: reference,
            },
          },
        })

        const transaction = transactions.docs[0] as Transaction | undefined

        if (!transaction) {
          throw new Error('No cash-on-delivery transaction found for the provided reference.')
        }

        // A double-submitted checkout would otherwise create a second order
        // against the same cart and charge the customer twice on delivery.
        if (transaction.order) {
          throw new Error('This checkout has already been confirmed.')
        }

        if (transaction.status !== 'pending') {
          throw new Error(`Cannot confirm a transaction that is ${transaction.status}.`)
        }

        const cartID =
          transaction.cart && typeof transaction.cart === 'object'
            ? transaction.cart.id
            : transaction.cart

        if (!cartID) {
          throw new Error('The transaction is not linked to a cart.')
        }

        const items = Array.isArray(transaction.items) ? transaction.items : []

        if (items.length === 0) {
          throw new Error('The transaction has no items to order.')
        }

        // The snapshot is a JSON column, so its generated type is the wide
        // `unknown`-ish union. It was written as an address in initiatePayment.
        const shippingAddress = (transaction.cod?.shippingAddressSnapshot ??
          transaction.billingAddress) as Order['shippingAddress']

        const customerEmail = data?.customerEmail || transaction.customerEmail

        // Priced here, at confirmation, rather than trusting a figure sent by
        // the client — otherwise a crafted request could set its own delivery
        // charge. The cart subtotal is likewise taken from the transaction.
        const shipping = await quoteShipping({
          city: shippingAddress?.city,
          items: items as ShippingLine[],
          payload,
          subtotal: transaction.amount ?? 0,
        })

        /*
         * Priced from the stored code, never from a figure sent by the browser
         * — the same reasoning as the delivery charge above. A coupon that has
         * since expired, been switched off or hit its usage limit simply stops
         * applying, and the order goes through at full price rather than
         * failing at the last step.
         */
        const subtotal = transaction.amount ?? 0
        const storedCode = (transaction.cod as undefined | { couponCode?: unknown })?.couponCode

        const couponResult =
          typeof storedCode === 'string' && storedCode
            ? await resolveCoupon({ code: storedCode, payload, subtotal })
            : null

        const discount = couponResult?.valid ? couponResult.discount : 0

        const order = await payload.create({
          collection: ordersSlug as CollectionSlug,
          data: {
            // Grand total: goods, less any discount, plus delivery. The customer
            // hands the courier exactly this amount.
            amount: subtotal - discount + shipping.amount,
            ...(couponResult?.valid
              ? { couponCode: couponResult.coupon.code, discountAmount: discount }
              : {}),
            currency: transaction.currency,
            shippingAmount: shipping.amount,
            shippingZone: shipping.zoneLabel,
            totalWeightGrams: shipping.totalWeightGrams,
            ...(transaction.customer
              ? { customer: transaction.customer }
              : { customerEmail }),
            items: flattenItems(items as CartItemLike[]),
            shippingAddress,
            // Awaiting fulfilment. It is not `completed` until delivered and paid.
            status: 'processing',
            transactions: [transaction.id],
          },
          req,
        })

        // Independent of each other, so they go together rather than one after
        // the other. Two sequential writes to a database in another region is a
        // round trip the shopper spends staring at a spinner.
        await Promise.all([
          // Counted only now, after the order exists — an abandoned checkout
          // must not use up a limited code.
          ...(couponResult?.valid
            ? [
                payload.update({
                  id: couponResult.coupon.id,
                  collection: 'coupons',
                  data: { usageCount: (couponResult.coupon.usageCount ?? 0) + 1 },
                  overrideAccess: true,
                  req,
                }),
              ]
            : []),
          payload.update({
            id: cartID,
            collection: cartsSlug as CollectionSlug,
            data: {
              purchasedAt: new Date().toISOString(),
            },
            req,
          }),
          // Status stays `pending` on purpose — cash is collected at the door.
          payload.update({
            id: transaction.id,
            collection: transactionsSlug as CollectionSlug,
            data: {
              order: order.id,
            },
            req,
          }),
        ])

        return {
          message: 'Order placed. Payment will be collected on delivery.',
          orderID: order.id,
          transactionID: transaction.id,
        }
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Error confirming cash-on-delivery order' })
        throw new Error(
          error instanceof Error ? error.message : 'Unknown error confirming order',
        )
      }
    },
    group,
    initiatePayment: async ({ data, req, transactionsSlug }) => {
      const payload = req.payload
      const { billingAddress, cart, currency, customerEmail, shippingAddress } = data

      /*
       * Read off the raw request, not the adapter's `data`.
       *
       * The plugin builds that argument itself from a fixed list — billing
       * address, cart, currency, email, shipping address — so anything else in
       * the checkout body is dropped before it arrives. `req.data` still holds
       * the whole body, which is where the coupon actually is.
       */
      const couponCode = (req.data as undefined | { couponCode?: unknown })?.couponCode
      const amount = cart?.subtotal

      if (!currency) {
        throw new Error('Currency is required.')
      }

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty or not provided.')
      }

      if (!customerEmail || typeof customerEmail !== 'string') {
        throw new Error('A valid customer email is required to place an order.')
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        throw new Error('A valid amount is required to place an order.')
      }

      // Without somewhere to deliver to, a cash-on-delivery order is unfulfillable.
      if (!shippingAddress) {
        throw new Error('A shipping address is required for cash on delivery.')
      }

      try {
        const reference = generateReference()

        const transaction = await payload.create({
          collection: transactionsSlug as CollectionSlug,
          data: {
            ...(req.user ? { customer: req.user.id } : { customerEmail }),
            amount,
            billingAddress: billingAddress ?? shippingAddress,
            cart: cart.id,
            cod: {
              // Stored here rather than trusted from the confirm request, so the
              // code cannot be swapped between starting and finishing checkout.
              ...(typeof couponCode === 'string' && couponCode.trim()
                ? { couponCode: couponCode.trim().toUpperCase() }
                : {}),
              reference,
              // Stored as JSON, so the address is frozen as it was at checkout
              // even if the customer later edits their saved address.
              shippingAddressSnapshot: shippingAddress as unknown as Record<string, unknown>,
            },
            // The plugin types `currency` as a plain string; the generated
            // collection type narrows it to the configured currency codes.
            currency: currency as Transaction['currency'],
            items: flattenItems(cart.items as unknown as CartItemLike[]),
            paymentMethod: 'cod',
            status: 'pending',
          },
          req,
        })

        return {
          message: 'Cash-on-delivery checkout started.',
          reference,
          transactionID: transaction.id,
        }
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Error initiating cash-on-delivery payment' })
        throw new Error(
          error instanceof Error ? error.message : 'Unknown error initiating payment',
        )
      }
    },
    label,
  }
}

/**
 * The storefront counterpart. Import this in the Next.js app and pass it to the
 * ecommerce provider so the checkout UI knows COD exists without pulling any
 * server-only code into the browser bundle.
 */
export const cashOnDeliveryAdapterClient = (
  props?: PaymentAdapterClientArgs,
): PaymentAdapterClient => ({
  name: 'cod',
  confirmOrder: true,
  initiatePayment: true,
  label: props?.label || 'Cash on Delivery',
})
