import Redis from 'ioredis';
import config from './index';

let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        // Parse the URL to extract TLS requirement
        const url = config.redis.url;

        redis = new Redis(url, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                // Retry with exponential backoff
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
            // Upstash requires TLS
            tls: url.startsWith('rediss://') ? {} : undefined,
            // Keep connection alive
            keepAlive: 30000,
            // Connection timeout
            connectTimeout: 10000,
            // Don't use lazy connect for immediate connection check
            lazyConnect: false,
        });

        redis.on('connect', () => {
            console.log('✅ Connected to Redis');
        });

        redis.on('ready', () => {
            console.log('✅ Redis ready');
        });

        redis.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
        });

        redis.on('close', () => {
            console.log('📴 Redis connection closed');
        });

        redis.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });
    }
    return redis;
}

// Connect to Redis explicitly
export async function connectRedis(): Promise<void> {
    const client = getRedis();
    try {
        await client.ping();
        console.log('✅ Redis ping successful');
    } catch (err) {
        console.error('❌ Redis ping failed:', err);
        throw err;
    }
}

// Redis key builders for consistency
export const redisKeys = {
    // Active chat sessions
    session: (sessionId: string) => `session:${sessionId}`,

    // Matching queue
    matchQueue: () => 'queue:random',

    // User online status
    userOnline: (userId: string) => `user:online:${userId}`,

    // Rate limiting
    rateLimit: (userId: string, action: string) => `ratelimit:${userId}:${action}`,

    // Skip tracking
    skipCount: (userId: string) => `skip:count:${userId}`,

    // Penalty status
    penalty: (userId: string) => `penalty:${userId}`,

    // Active filters
    activeFilter: (userId: string, filterType: string) => `filter:${userId}:${filterType}`,

    // Match history - prevents rematching same person in 24h
    matchHistory: (userId: string) => `match:history:${userId}`,

    // Recent emoji for Same Vibe detection (stores last emoji per user in session)
    recentEmoji: (sessionId: string, userId: string) => `vibe:emoji:${sessionId}:${userId}`,
} as const;

export default getRedis;
