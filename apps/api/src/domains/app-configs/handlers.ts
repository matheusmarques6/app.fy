import type { Dependencies } from '@appfy/core'
import { BuildError } from '@appfy/core'
import type { Context } from 'hono'
import type { UpdateAppConfigBody } from './schemas.js'

export function createAppConfigHandlers(deps: Dependencies) {
  return {
    /** GET /app-configs — Get app config for tenant */
    async get(c: Context) {
      const tenantId = c.get('tenantId') as string
      const config = await deps.appConfigService.getConfig(tenantId)
      return c.json({ data: config ?? null })
    },

    /** PUT /app-configs — Update app config (editor+) */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as UpdateAppConfigBody
      const config = await deps.appConfigService.updateConfig(tenantId, body)
      return c.json({ data: config })
    },

    /** POST /app-configs/build — Trigger build (owner only) */
    async triggerBuild(c: Context) {
      const tenantId = c.get('tenantId') as string
      const userId = c.get('userId') as string
      try {
        const result = await deps.buildService.triggerBuild(tenantId, userId)
        return c.json({ data: result }, 201)
      } catch (err) {
        if (err instanceof BuildError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    },

    /** GET /app-configs/build/status — Get current build status */
    async buildStatus(c: Context) {
      const tenantId = c.get('tenantId') as string
      try {
        const result = await deps.buildService.getBuildStatus(tenantId)
        return c.json({ data: result })
      } catch (err) {
        if (err instanceof BuildError) {
          return c.json({ error: err.message }, 404)
        }
        throw err
      }
    },
  }
}
