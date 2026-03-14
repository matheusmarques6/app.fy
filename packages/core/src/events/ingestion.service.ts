import { appEventTypes } from '@appfy/shared'
import type { AppEventType } from '@appfy/shared'
import { InvalidEventTypeError } from '../errors.js'
import type { AuditLogger } from '../notifications/service.js'
import type { EventRepository } from './repository.js'
import type { AppEventRow, IngestEventInput } from './types.js'

/** Queue adapter for dispatching async jobs */
export interface EventQueueAdapter {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }>
}

export interface EventIngestionDeps {
  eventRepo: EventRepository
  queueAdapter?: EventQueueAdapter
  auditLog?: AuditLogger
}

/** Deduplication window in seconds */
const DEDUP_WINDOW_SECONDS = 5

/**
 * Ingests app events with deduplication and async processing.
 *
 * Logic:
 * 1. Validate eventType is in allowed list
 * 2. Dedup check: same appUserId + eventType within 5s → reject
 * 3. Create event record
 * 4. Queue async processing on data-ingestion queue
 */
export class EventIngestionService {
  private readonly eventRepo: EventRepository
  private readonly queueAdapter: EventQueueAdapter | undefined
  // auditLog reserved for future use (audit trail on event ingestion)

  constructor(deps: EventIngestionDeps) {
    this.eventRepo = deps.eventRepo
    this.queueAdapter = deps.queueAdapter
  }

  async ingest(tenantId: string, input: IngestEventInput): Promise<AppEventRow | null> {
    // 1. Validate event type
    if (!this.isValidEventType(input.eventType)) {
      throw new InvalidEventTypeError(input.eventType)
    }

    const eventType = input.eventType as AppEventType

    // 2. Deduplication check
    const recent = await this.eventRepo.findRecent(
      tenantId,
      input.appUserId,
      eventType,
      DEDUP_WINDOW_SECONDS,
    )
    if (recent.length > 0) {
      return null
    }

    // 3. Create event record
    const createInput: import('./types.js').CreateEventInput = {
      appUserId: input.appUserId,
      eventType,
      ...(input.properties !== undefined && { properties: input.properties }),
    }
    const event = await this.eventRepo.create(tenantId, createInput)

    // 4. Queue async processing
    if (this.queueAdapter) {
      await this.queueAdapter.add('process-event', {
        tenantId,
        eventId: event.id,
        eventType,
        appUserId: input.appUserId,
      })
    }

    return event
  }

  private isValidEventType(eventType: string): eventType is AppEventType {
    return (appEventTypes as readonly string[]).includes(eventType)
  }
}
