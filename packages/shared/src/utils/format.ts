/**
 * Format cents to BRL currency string.
 * @example formatCentsToBrl(12700) // "R$ 127,00"
 */
export function formatCentsToBrl(cents: number): string {
  const reais = cents / 100
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Truncate a string to a maximum length, appending ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength - 1)}…`
}

/**
 * Slugify a string for URL-safe usage.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
