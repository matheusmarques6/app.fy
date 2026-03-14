import type { AppConfigRow } from '../app-configs/repository.js'

export type BuildStatus = 'pending' | 'building' | 'ready' | 'published'

const VALID_TRANSITIONS: Record<string, BuildStatus[]> = {
  pending: ['building'],
  building: ['ready', 'pending'], // pending = failed/reset
  ready: ['published', 'building'],
  published: ['building'],
}

export interface BuildQueueAdapter {
  addBuildJob(tenantId: string, appConfigId: string, triggeredBy: string): Promise<void>
}

export interface AppConfigLookup {
  findByTenantId(tenantId: string): Promise<AppConfigRow | undefined>
  updateBuildStatus(tenantId: string, status: BuildStatus): Promise<AppConfigRow>
}

export interface BuildServiceDeps {
  readonly appConfigLookup: AppConfigLookup
  readonly buildQueue: BuildQueueAdapter
}

export class BuildService {
  constructor(private readonly deps: BuildServiceDeps) {}

  async triggerBuild(tenantId: string, triggeredBy: string): Promise<{ status: BuildStatus }> {
    const config = await this.deps.appConfigLookup.findByTenantId(tenantId)
    if (!config) {
      throw new BuildError('App config not found for tenant')
    }

    const currentStatus = (config.buildStatus as BuildStatus) ?? 'pending'
    if (!this.canTransition(currentStatus, 'building')) {
      throw new BuildError(`Cannot start build: current status is "${currentStatus}"`)
    }

    await this.deps.appConfigLookup.updateBuildStatus(tenantId, 'building')
    await this.deps.buildQueue.addBuildJob(tenantId, config.id, triggeredBy)

    return { status: 'building' }
  }

  async getBuildStatus(tenantId: string): Promise<{ status: BuildStatus; lastBuildAt: Date | null }> {
    const config = await this.deps.appConfigLookup.findByTenantId(tenantId)
    if (!config) {
      throw new BuildError('App config not found for tenant')
    }

    return {
      status: (config.buildStatus as BuildStatus) ?? 'pending',
      lastBuildAt: config.lastBuildAt,
    }
  }

  async completeBuild(tenantId: string, success: boolean): Promise<{ status: BuildStatus }> {
    const current = await this.deps.appConfigLookup.findByTenantId(tenantId)
    if (!current) {
      throw new BuildError('App config not found for tenant')
    }

    const currentStatus = (current.buildStatus as BuildStatus) ?? 'pending'
    const newStatus: BuildStatus = success ? 'ready' : 'pending'

    if (!this.canTransition(currentStatus, newStatus)) {
      throw new BuildError(`Cannot complete build: current status is "${currentStatus}"`)
    }

    const config = await this.deps.appConfigLookup.updateBuildStatus(tenantId, newStatus)
    return { status: (config.buildStatus as BuildStatus) ?? newStatus }
  }

  private canTransition(from: BuildStatus, to: BuildStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }
}

export class BuildError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BuildError'
  }
}
