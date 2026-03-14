/**
 * Format a number as currency.
 * @param value - The numeric value (in major units, e.g., 127.50)
 * @param locale - The locale for formatting (default: 'pt-BR')
 * @param currency - The currency code (default: 'BRL')
 * @returns Formatted currency string
 * @example formatCurrency(127.50) // "R$ 127,50"
 * @example formatCurrency(99.99, 'en-US', 'USD') // "$99.99"
 */
export function formatCurrency(
  value: number,
  locale: string = 'pt-BR',
  currency: string = 'BRL',
): string {
  return value.toLocaleString(locale, {
    style: 'currency',
    currency,
  })
}
