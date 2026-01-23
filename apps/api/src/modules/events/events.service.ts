import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  QUEUE_NAMES,
  RATE_LIMIT_EVENTS_PER_DEVICE,
  RATE_LIMIT_EVENTS_PER_STORE,
  validateEventProps,
  isValidEventTimestamp,
  ALLOWED_EVENT_NAMES,
} from '@appfy/shared';
import type { EventIngestRequest, EventIngestResponse, EventPayload } from '@appfy/shared';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_NAMES.EVENTS_INGEST)
    private readonly eventsQueue: Queue,
  ) {}

  /**
   * Ingest events from device
   * - Rate limit per device and store
   * - Validate schema
   * - Queue for async processing
   */
  async ingestEvents(
    storeId: string,
    deviceId: string,
    request: EventIngestRequest,
  ): Promise<EventIngestResponse> {
    const accepted: string[] = [];
    const rejected: Array<{ event_id: string; reason: string }> = [];

    // Rate limit check - device
    const deviceLimit = await this.redis.checkRateLimit(
      `events:device:${deviceId}`,
      RATE_LIMIT_EVENTS_PER_DEVICE,
      60,
    );
    if (!deviceLimit.allowed) {
      return {
        accepted: [],
        rejected: request.events.map((e) => ({
          event_id: e.event_id,
          reason: 'rate_limit_device',
        })),
      };
    }

    // Rate limit check - store
    const storeLimit = await this.redis.checkRateLimit(
      `events:store:${storeId}`,
      RATE_LIMIT_EVENTS_PER_STORE,
      1,
    );
    if (!storeLimit.allowed) {
      return {
        accepted: [],
        rejected: request.events.map((e) => ({
          event_id: e.event_id,
          reason: 'rate_limit_store',
        })),
      };
    }

    // Process each event
    for (const event of request.events) {
      const validation = this.validateEvent(event);
      if (!validation.valid) {
        rejected.push({ event_id: event.event_id, reason: validation.reason! });
        continue;
      }

      // Check idempotency
      const exists = await this.redis.exists(`event:${storeId}:${event.event_id}`);
      if (exists) {
        // Already processed, accept silently (idempotent)
        accepted.push(event.event_id);
        continue;
      }

      // Queue for processing
      await this.eventsQueue.add(
        'process',
        {
          storeId,
          deviceId,
          event,
          identityHint: request.identity_hint,
        },
        {
          jobId: `${storeId}:${event.event_id}`,
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );

      // Mark as seen (for idempotency)
      await this.redis.set(`event:${storeId}:${event.event_id}`, '1', 86400);

      accepted.push(event.event_id);
    }

    return { accepted, rejected };
  }

  private validateEvent(event: EventPayload): { valid: boolean; reason?: string } {
    // Validate event_id
    if (!event.event_id || typeof event.event_id !== 'string') {
      return { valid: false, reason: 'invalid_event_id' };
    }

    // Validate event name
    if (!ALLOWED_EVENT_NAMES.includes(event.name as any)) {
      return { valid: false, reason: 'invalid_event_name' };
    }

    // Validate timestamp
    if (!isValidEventTimestamp(event.ts)) {
      return { valid: false, reason: 'invalid_timestamp' };
    }

    // Validate props
    if (event.props) {
      const propsValidation = validateEventProps(event.props as Record<string, unknown>);
      if (!propsValidation.valid) {
        return { valid: false, reason: propsValidation.error };
      }
    }

    return { valid: true };
  }
}
