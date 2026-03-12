import { TenantNotFoundError } from '../errors.js'
import type {
  CreateTenantInput,
  TenantRepository,
  TenantRow,
  UpdateTenantInput,
} from './repository.js'

export class TenantService {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async create(tenantId: string, input: CreateTenantInput): Promise<TenantRow> {
    return this.tenantRepo.create(tenantId, input)
  }

  async findById(tenantId: string): Promise<TenantRow> {
    const tenant = await this.tenantRepo.findById(tenantId)
    if (!tenant) {
      throw new TenantNotFoundError(tenantId)
    }
    return tenant
  }

  async findBySlug(tenantId: string, slug: string): Promise<TenantRow> {
    const tenant = await this.tenantRepo.findBySlug(tenantId, slug)
    if (!tenant) {
      throw new TenantNotFoundError(slug)
    }
    return tenant
  }

  async update(tenantId: string, input: UpdateTenantInput): Promise<TenantRow> {
    await this.findById(tenantId)
    return this.tenantRepo.update(tenantId, input)
  }

  async updateNotificationCount(tenantId: string, amount: number): Promise<void> {
    await this.findById(tenantId)
    return this.tenantRepo.incrementNotificationCount(tenantId, amount)
  }
}
