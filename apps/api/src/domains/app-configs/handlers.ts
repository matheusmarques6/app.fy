import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { UpdateAppConfigBody } from './schemas.js'

export function createAppConfigHandlers(_deps: Dependencies) {
  return {
    /** GET /app-configs — Get app config for tenant */
    async get(c: Context) {
      const tenantId = c.get('tenantId') as string
      // TODO: Fetch app config from AppConfigRepository
      return c.json({
        data: {
          tenantId,
          appName: null,
          primaryColor: null,
          secondaryColor: null,
          iconUrl: null,
          splashUrl: null,
        },
      })
    },

    /** PUT /app-configs — Update app config (editor+) */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as UpdateAppConfigBody
      // TODO: Update app config via AppConfigRepository
      return c.json({
        data: {
          tenantId,
          ...body,
        },
      })
    },
  }
}
