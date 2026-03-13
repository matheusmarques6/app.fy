import type { Dependencies, UpdateAutomationInput } from '@appfy/core'
import type { FlowType } from '@appfy/shared'
import type { Context } from 'hono'
import type { ToggleAutomationBody, UpdateAutomationBody } from './schemas.js'

export function createAutomationHandlers(deps: Dependencies) {
  return {
    /** GET /automations — List all 9 automation configs for tenant */
    async list(c: Context) {
      const tenantId = c.get('tenantId') as string
      const configs = await deps.automationService.listConfigs(tenantId)
      return c.json({ data: configs })
    },

    /** GET /automations/:flowType — Get specific config */
    async getByFlowType(c: Context) {
      const tenantId = c.get('tenantId') as string
      const flowType = c.req.param('flowType') as FlowType
      const config = await deps.automationService.getConfig(tenantId, flowType)
      return c.json({ data: config })
    },

    /** PUT /automations/:flowType — Update config (editor+) */
    async update(c: Context) {
      const tenantId = c.get('tenantId') as string
      const flowType = c.req.param('flowType') as FlowType
      const body = c.get('validatedBody' as never) as UpdateAutomationBody

      // Build input with only defined properties (exactOptionalPropertyTypes)
      const input: UpdateAutomationInput = {}
      if (body.delaySeconds !== undefined) {
        (input as Record<string, unknown>).delaySeconds = body.delaySeconds
      }
      if (body.templateTitle !== undefined) {
        (input as Record<string, unknown>).templateTitle = body.templateTitle
      }
      if (body.templateBody !== undefined) {
        (input as Record<string, unknown>).templateBody = body.templateBody
      }

      const updated = await deps.automationService.updateConfig(tenantId, flowType, input)
      return c.json({ data: updated })
    },

    /** PATCH /automations/:flowType/toggle — Toggle enabled/disabled */
    async toggle(c: Context) {
      const tenantId = c.get('tenantId') as string
      const flowType = c.req.param('flowType') as FlowType
      const body = c.get('validatedBody' as never) as ToggleAutomationBody

      await deps.automationService.toggleEnabled(tenantId, flowType, body.isEnabled)
      return c.json({ data: { flowType, isEnabled: body.isEnabled } })
    },
  }
}
