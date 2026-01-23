/**
 * Money utilities - Always use minor units (centavos/cents)
 *
 * Rule: All monetary values are stored and transmitted as integers
 * representing the smallest currency unit (e.g., centavos for BRL)
 */

export interface Money {
  amount_minor: number;
  currency: string;
}

/**
 * Convert decimal amount to minor units
 * @example toMinorUnits(199.90, 'BRL') => 19990
 */
export function toMinorUnits(amount: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return Math.round(amount * Math.pow(10, decimals));
}

/**
 * Convert minor units to decimal amount
 * @example fromMinorUnits(19990, 'BRL') => 199.90
 */
export function fromMinorUnits(amountMinor: number, currency: string): number {
  const decimals = getCurrencyDecimals(currency);
  return amountMinor / Math.pow(10, decimals);
}

/**
 * Format money for display
 * @example formatMoney({ amount_minor: 19990, currency: 'BRL' }, 'pt-BR') => "R$ 199,90"
 */
export function formatMoney(money: Money, locale: string): string {
  const amount = fromMinorUnits(money.amount_minor, money.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(amount);
}

/**
 * Get decimal places for currency (ISO 4217)
 */
export function getCurrencyDecimals(currency: string): number {
  const zeroDecimalCurrencies = [
    'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
  ];

  const threeDecimalCurrencies = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];

  const upperCurrency = currency.toUpperCase();

  if (zeroDecimalCurrencies.includes(upperCurrency)) return 0;
  if (threeDecimalCurrencies.includes(upperCurrency)) return 3;
  return 2; // Default for most currencies
}

/**
 * Add two money values (must be same currency)
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return {
    amount_minor: a.amount_minor + b.amount_minor,
    currency: a.currency,
  };
}

/**
 * Multiply money by a factor
 */
export function multiplyMoney(money: Money, factor: number): Money {
  return {
    amount_minor: Math.round(money.amount_minor * factor),
    currency: money.currency,
  };
}
