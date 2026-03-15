interface RedisConnectionOptions {
  host: string
  port: number
  maxRetriesPerRequest: null
  password?: string
  username?: string
  tls?: { rejectUnauthorized: boolean }
}

/**
 * Creates Redis connection options from a URL string.
 * Handles both standard `redis://` and Upstash TLS `rediss://` protocols.
 * Sets `maxRetriesPerRequest: null` as required by BullMQ.
 */
export function createRedisConnectionOptions(redisUrl: string): RedisConnectionOptions {
  const url = new URL(redisUrl)

  const isTls = url.protocol === 'rediss:'

  const options: RedisConnectionOptions = {
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
