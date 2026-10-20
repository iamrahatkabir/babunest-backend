import type { NumberField } from 'payload'

/**
 * Shipping weight in grams.
 *
 * Grams rather than kilograms so the value is always an integer — a decimal
 * kilogram field invites 0.30000000000000004 and rounding arguments when
 * summing a cart. The shipping calculator converts once, at the end.
 *
 * Optional: products left blank fall back to the default weight configured in
 * Shipping Settings, so an unweighed item never ships as if it were weightless.
 */
export const weightField = (): NumberField => ({
  name: 'weightGrams',
  type: 'number',
  admin: {
    description: 'Shipping weight in grams, including packaging. Used to price delivery.',
    step: 50,
  },
  label: 'Weight (g)',
  min: 0,
})
