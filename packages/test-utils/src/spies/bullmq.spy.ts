import { SpyBase } from './spy-base.js'

export interface QueuedJob {
  readonly name: string
  readonly data: unknown
  readonly opts: Record<string, unknown> | undefined
}

export class BullMQSpy extends SpyBase {
  private jobs: QueuedJob[] = []

  async add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }> {
    this.trackCall('add', [name, data, opts])
    this.jobs.push({ name, data, opts })
    return { id: crypto.randomUUID() }
  }

  async addBulk(
    jobs: Array<{ name: string; data: unknown; opts?: Record<string, unknown> }>,
  ): Promise<Array<{ id: string }>> {
    this.trackCall('addBulk', [jobs])
    for (const job of jobs) {
      this.jobs.push({ name: job.name, data: job.data, opts: job.opts })
    }
    return jobs.map(() => ({ id: crypto.randomUUID() }))
  }

  /** Returns all jobs that were added to this queue spy */
  getJobs(): QueuedJob[] {
    return [...this.jobs]
  }

  /** Returns jobs filtered by name */
  getJobsByName(name: string): QueuedJob[] {
    return this.jobs.filter((j) => j.name === name)
  }

  override reset(): void {
    super.reset()
    this.jobs = []
  }
}
