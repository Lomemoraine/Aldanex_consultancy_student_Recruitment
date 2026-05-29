// lib/redis.js
// Redis client using ioredis. Reads REDIS_URL from environment.
// Set REDIS_URL in your .env file:
//   Local:      REDIS_URL=redis://localhost:6379
//   Upstash:    REDIS_URL=rediss://:password@host:port
//   Redis Cloud: REDIS_URL=redis://:password@host:port

const Redis = require('ioredis');

let client;

function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set.');
  }

  client = new Redis(redisUrl, {
    // Retry up to 3 times with exponential backoff, then stop
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    // TLS is required for Upstash / Redis Cloud (rediss:// URLs)
    // ioredis enables TLS automatically for rediss:// — nothing extra needed
  });

  client.on('connect', () => console.log('[Redis] Connected'));
  client.on('error', (err) => console.error('[Redis] Error:', err.message));

  return client;
}

module.exports = { getRedisClient };