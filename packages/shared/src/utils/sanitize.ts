/**
 * Strips dangerous HTML/JS content from text while preserving safe characters.
 * Removes: script tags, event handlers, javascript: URIs, dangerous HTML tags.
 * Preserves: accents, emojis, currency symbols, plain text.
 */
export function sanitizeText(input: string): string {
  let result = input

  // Remove nested/obfuscated script tags (handle recursive nesting like <scr<script>ipt>)
  let previous = ''
  while (previous !== result) {
    previous = result
    result = result.replace(/<\s*\/?\s*script[^>]*>/gi, '')
  }

  // Remove img tags with event handlers
  result = result.replace(/<\s*img[^>]*>/gi, '')

  // Remove all HTML event handlers (on* attributes) from remaining tags
  result = result.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')

  // Remove javascript: protocol URIs
  result = result.replace(/javascript\s*:/gi, '')

  // Remove remaining dangerous tags (iframe, object, embed, form, etc.)
  result = result.replace(/<\s*\/?\s*(iframe|object|embed|form|input|textarea|button|select|style|link|meta|base|applet)\b[^>]*>/gi, '')

  return result
}
