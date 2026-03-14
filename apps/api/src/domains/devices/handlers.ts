import type { Dependencies } from '@appfy/core'
import type { Context } from 'hono'
import type { RegisterDeviceBody } from './schemas.js'

export function createDeviceHandlers(deps: Dependencies) {
  return {
    /** GET /devices — List devices for a specific app user */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const appUserId = c.req.query('appUserId')
      if (!appUserId) {
        return c.json(
          { error: { code: 'MISSING_PARAM', message: 'appUserId query param required' } },
          400,
        )
      }
      const devices = await deps.deviceService.findActiveByUser(tenantId, appUserId)
      return c.json({ data: devices })
    },

    /** POST /devices — Register device */
    async register(c: Context) {
      const tenantId = c.get('tenantId') as string
      const body = c.get('validatedBody' as never) as RegisterDeviceBody

      const device = await deps.deviceService.register(tenantId, {
        appUserId: body.appUserId,
        deviceToken: body.deviceToken,
        platform: body.platform,
        ...(body.osVersion !== undefined && { osVersion: body.osVersion }),
        ...(body.appVersion !== undefined && { appVersion: body.appVersion }),
      })
      return c.json({ data: device }, 201)
    },

    /** DELETE /devices/:id — Deactivate device (soft delete) */
    async deactivate(c: Context) {
      const tenantId = c.get('tenantId') as string
      const id = c.req.param('id')!
      await deps.deviceService.deactivate(tenantId, id)
      return c.json({ data: { id, deactivated: true } })
    },
  }
}
