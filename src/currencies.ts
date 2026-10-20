import type { CurrenciesConfig, Currency } from '@payloadcms/plugin-ecommerce/types'

/**
 * The plugin ships USD, EUR and GBP only, so Taka is defined here.
 *
 * Like every currency in the plugin, amounts are stored as integers in the
 * minor unit — a price of ৳1,250.00 is stored as 125000 poisha. This avoids
 * floating-point drift when totalling a cart.
 */
export const BDT: Currency = {
  code: 'BDT',
  decimals: 2,
  label: 'Bangladeshi Taka',
  symbol: '৳',
}

/**
 * Shared so that fields we add ourselves — the compare-at price, for one — get
 * the same admin formatting as the price fields the plugin generates.
 */
export const currenciesConfig: CurrenciesConfig = {
  defaultCurrency: BDT.code,
  supportedCurrencies: [BDT],
}
