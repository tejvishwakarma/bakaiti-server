import { Request, Response, NextFunction } from 'express';
import getRedis, { redisKeys } from '../config/redis';
import config from '../config';

export async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const redis = getRedis();
        let key: string;
        let limit: number;

        if (req.user) {
            // Authenticated user limit
            key = redisKeys.rateLimit(req.user.id, 'api');
            limit = config.rateLimit.maxMessagesPerMinute;
        } else {
            // IP-based limit (fallback)
            const ip = req.ip || req.socket.remoteAddress || 'unknown';
            key = `ratelimit:ip:${ip}`;
            limit = 30; // Stricter limit for unauthenticated requests
        }

        const count = await redis.incr(key);

        if (count === 1) {
            // Set expiry on first request (1 minute window)
            await redis.expire(key, 60);
        }

        if (count > limit) {
            res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
            return;
        }

        next();
    } catch (error) {
        console.error('Rate limit middleware error:', error);
        // Don't block on rate limit errors
        next();
    }
}

export default rateLimitMiddleware;
