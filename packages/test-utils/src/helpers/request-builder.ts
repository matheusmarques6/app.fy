/**
 * Fluent request builder for Hono app testing.
 *
 * Wraps Hono's app.request() with a clean API for setting
 * auth headers, tenant context, and request body.
 *
 * @example
 * const res = await new RequestBuilder(app)
 *   .get('/api/notifications')
 *   .withAuth(jwt)
 *   .withTenant(tenantId)
 *   .send()
 *
 * expect(res.status).toBe(200)
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface HonoApp {
  request(path: string, init?: RequestInit): Promise<Response>
}

export class RequestBuilder {
  private method: HttpMethod = 'GET'
  private path = '/'
  private headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  private requestBody: unknown = undefined

  constructor(private readonly app: HonoApp) {}

  get(path: string): this {
    this.method = 'GET'
    this.path = path
    return this
  }

  post(path: string): this {
    this.method = 'POST'
    this.path = path
    return this
  }

  put(path: string): this {
    this.method = 'PUT'
    this.path = path
    return this
  }

  patch(path: string): this {
    this.method = 'PATCH'
    this.path = path
    return this
  }

  delete(path: string): this {
    this.method = 'DELETE'
    this.path = path
    return this
  }

  withAuth(jwt: string): this {
    this.headers.authorization = `Bearer ${jwt}`
    return this
  }

  withTenant(tenantId: string): this {
    this.headers['x-tenant-id'] = tenantId
    return this
  }

  withHeader(name: string, value: string): this {
    this.headers[name] = value
    return this
  }

  withBody(body: unknown): this {
    this.requestBody = body
    return this
  }

  withJsonBody(body: unknown): this {
    return this.withBody(body)
  }

  async send(): Promise<Response> {
    const init: RequestInit = {
      method: this.method,
      headers: this.headers,
    }

    if (this.requestBody !== undefined && this.method !== 'GET') {
      init.body = JSON.stringify(this.requestBody)
    }

    return this.app.request(this.path, init)
  }

  /**
   * Sends the request and parses the JSON response.
   */
  async sendJson<T = unknown>(): Promise<{ status: number; body: T }> {
    const res = await this.send()
    const body = (await res.json()) as T
    return { status: res.status, body }
  }
}
