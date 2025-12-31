import { Request, Response, NextFunction } from 'express';
import getRedis, { redisKeys } from '../config/redis';
import config from '../config';

export async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.user) {
            next();
            return;
        }

        const redis = getRedis();
        const key = redisKeys.rateLimit(req.user.id, 'api');

        const count = await redis.incr(key);

        if (count === 1) {
            // Set expiry on first request (1 minute window)
            await redis.expire(key, 60);
        }

        if (count > config.rateLimit.maxMessagesPerMinute) {
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
