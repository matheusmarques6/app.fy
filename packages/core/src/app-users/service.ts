import type { PaginatedResponse, PaginationParams } from '@appfy/shared'
import { buildPaginatedResponse, normalizePagination } from '../common/pagination.js'
import { AppUserNotFoundError } from '../errors.js'
import type {
  AppUserRepository,
  AppUserRow,
  CreateAppUserInput,
  UpdateAppUserInput,
} from './repository.js'

export class AppUserService {
  constructor(private readonly appUserRepo: AppUserRepository) {}

  async create(tenantId: string, input: CreateAppUserInput): Promise<AppUserRow> {
    return this.appUserRepo.create(tenantId, input)
  }

  async findById(tenantId: string, id: string): Promise<AppUserRow> {
    const user = await this.appUserRepo.findById(tenantId, id)
    if (!user) {
      throw new AppUserNotFoundError(id)
    }
    return user
  }

  async findByExternalId(tenantId: string, externalId: string): Promise<AppUserRow> {
    const user = await this.appUserRepo.findByExternalId(tenantId, externalId)
    if (!user) {
      throw new AppUserNotFoundError(externalId)
    }
    return user
  }

  async update(tenantId: string, id: string, input: UpdateAppUserInput): Promise<AppUserRow> {
    await this.findById(tenantId, id)
    return this.appUserRepo.update(tenantId, id, input)
  }

  async updatePushOptIn(tenantId: string, id: string, optIn: boolean): Promise<void> {
    await this.findById(tenantId, id)
    return this.appUserRepo.updatePushOptIn(tenantId, id, optIn)
  }

  async list(
    tenantId: string,
    pagination?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<AppUserRow>> {
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.appUserRepo.list(tenantId, normalized)
    return buildPaginatedResponse(data, total, normalized)
  }
}
