// ──────────────────────────────────────────────
// HTTP Client abstraction for testability
// ──────────────────────────────────────────────

export interface HttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>
  post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T>
  delete(url: string, headers?: Record<string, string>): Promise<void>
}

/**
 * Production HTTP client using the Fetch API.
 */
export class FetchHttpClient implements HttpClient {
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, headers ? { headers } : {})
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return res.json() as Promise<T>
  }

  async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return res.json() as Promise<T>
  }

  async delete(url: string, headers?: Record<string, string>): Promise<void> {
    const res = await fetch(url, headers ? { method: 'DELETE', headers } : { method: 'DELETE' })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
}
