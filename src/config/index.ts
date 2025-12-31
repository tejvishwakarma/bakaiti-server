import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    database: {
        url: process.env.DATABASE_URL || '',
    },

    redis: {
        url: process.env.REDIS_URL || '',
    },

    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
    },

    cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    },

    // Points economy configuration
    points: {
        rewardedAdFirst5: 40,
        rewardedAdAfter5: 25,
        maxAdsPerDay: 8,
        dailyLoginBase: 30,
        dailyLoginMaxStreak: 75,
        wordBombWinner: 10,
    },

    // Skip penalty configuration
    skipPenalty: {
        rapidSkipThreshold: 3,      // 3 skips
        rapidSkipTimeWindow: 60,     // in 60 seconds
        rapidSkipCooldown: 5 * 60,   // 5 min cooldown

        frequentSkipThreshold: 10,   // 10 skips
        frequentSkipTimeWindow: 5 * 60, // in 5 minutes
        frequentSkipCooldown: 15 * 60,  // 15 min cooldown

        repeatedPatternCooldown: 60 * 60, // 1 hour timeout
    },

    // Rate limiting
    rateLimit: {
        maxMessagesPerMinute: 50,
    },

    // Image settings
    images: {
        maxSizeKB: 2048,
        expiryMinutes: 5,
    },
} as const;

export default config;
