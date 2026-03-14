import { getTenantConfig } from '@mobile/config/app.config';
import { getAuthHeaders } from '@mobile/utils/auth';
import { getDeviceId } from '@mobile/utils/device';
import { getFromStorage, setToStorage } from '@mobile/utils/storage';
import type { AppEvent, AppEventType } from './types';

const EVENT_QUEUE_KEY = 'appfy_event_queue';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;

let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Track an app event. Events are queued locally and flushed to the backend in batches.
 * If offline, events remain in queue until connectivity is restored.
 */
export async function trackEvent(
  eventType: AppEventType,
  metadata: Record<string, unknown> = {},
  userId: string | null = null,
): Promise<void> {
  const deviceId = await getDeviceId();

  const event: AppEvent = {
    eventType,
    deviceId,
    userId,
    timestamp: new Date().toISOString(),
    metadata,
  };

  await enqueueEvent(event);

  const queue = await getEventQueue();
  if (queue.length >= BATCH_SIZE) {
    await flushEvents();
  }
}

/**
 * Start periodic event flushing.
 */
export function startEventFlushing(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushEvents();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Stop periodic event flushing.
 */
export function stopEventFlushing(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Flush queued events to the backend API.
 */
export async function flushEvents(): Promise<void> {
  const queue = await getEventQueue();
  if (queue.length === 0) return;

  const config = getTenantConfig();
  const url = `${config.apiBaseUrl}/events/batch`;

  try {
    const headers = await getAuthHeaders(config.tenantId);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: queue }),
    });

    if (response.ok) {
      await clearEventQueue();
    }
    // If not ok, events remain in queue for next flush
  } catch {
    // Offline or network error — events stay queued
  }
}

async function enqueueEvent(event: AppEvent): Promise<void> {
  const queue = await getEventQueue();
  queue.push(event);
  await setToStorage(EVENT_QUEUE_KEY, JSON.stringify(queue));
}

async function getEventQueue(): Promise<AppEvent[]> {
  const raw = await getFromStorage(EVENT_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppEvent[];
  } catch {
    return [];
  }
}

async function clearEventQueue(): Promise<void> {
  await setToStorage(EVENT_QUEUE_KEY, JSON.stringify([]));
}
