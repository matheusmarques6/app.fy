import type { RedisOptions } from 'ioredis'

/**
 * Creates Redis connection options from a URL string.
 * Handles both standard `redis://` and Upstash TLS `rediss://` protocols.
 * Sets `maxRetriesPerRequest: null` as required by BullMQ.
 */
export function createRedisConnectionOptions(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl)

  const isTls = url.protocol === 'rediss:'

  const options: RedisOptions = {
    host: url.hostname,
    port: Number(url.port) || (isTls ? 6380 : 6379),
    maxRetriesPerRequest: null, // Required by BullMQ
  }

  if (url.password) {
    options.password = url.password
  }

  if (url.username && url.username !== 'default') {
    options.username = url.username
  }

  if (isTls) {
    options.tls = {
      rejectUnauthorized: true,
    }
  }

  return options
}
