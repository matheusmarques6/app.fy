import type { PaginatedResponse, PaginationParams } from '@appfy/shared'
import { buildPaginatedResponse, normalizePagination } from '../common/pagination.js'
import { DomainError } from '../errors.js'
import type {
  CreateSegmentInput,
  SegmentRepository,
  SegmentRow,
  UpdateSegmentInput,
} from './repository.js'
import { validateSegmentRules } from './rules-engine.js'

export class SegmentNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`Segment not found: ${identifier}`, 'SEGMENT_NOT_FOUND')
  }
}

export class SegmentService {
  constructor(private readonly segmentRepo: SegmentRepository) {}

  async create(tenantId: string, input: CreateSegmentInput): Promise<SegmentRow> {
    if (!input.name || input.name.trim() === '') {
      throw new DomainError('Segment name is required', 'VALIDATION_ERROR')
    }

    const errors = validateSegmentRules(input.rules)
    if (errors.length > 0) {
      throw new DomainError(`Invalid segment rules: ${errors.join('; ')}`, 'VALIDATION_ERROR')
    }

    return this.segmentRepo.create(tenantId, input)
  }

  async findById(tenantId: string, id: string): Promise<SegmentRow> {
    const segment = await this.segmentRepo.findById(tenantId, id)
    if (!segment) {
      throw new SegmentNotFoundError(id)
    }
    return segment
  }

  async update(tenantId: string, id: string, input: UpdateSegmentInput): Promise<SegmentRow> {
    await this.findById(tenantId, id)

    if (input.rules) {
      const errors = validateSegmentRules(input.rules)
      if (errors.length > 0) {
        throw new DomainError(`Invalid segment rules: ${errors.join('; ')}`, 'VALIDATION_ERROR')
      }
    }

    return this.segmentRepo.update(tenantId, id, input)
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.findById(tenantId, id)
    return this.segmentRepo.delete(tenantId, id)
  }

  async list(
    tenantId: string,
    pagination?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<SegmentRow>> {
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.segmentRepo.list(tenantId, normalized)
    return buildPaginatedResponse(data, total, normalized)
  }

  async getMembers(
    tenantId: string,
    segmentId: string,
    pagination?: Partial<PaginationParams>,
  ): Promise<PaginatedResponse<string>> {
    await this.findById(tenantId, segmentId)
    const normalized = normalizePagination(pagination)
    const { data, total } = await this.segmentRepo.getMembers(tenantId, segmentId, normalized)
    return buildPaginatedResponse(data, total, normalized)
  }
}
