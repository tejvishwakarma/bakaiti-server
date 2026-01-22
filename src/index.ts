import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimitMiddleware } from './middleware/rateLimit';

import config from './config';
import { initializeFirebase } from './config/firebase';
import getRedis from './config/redis';
import prisma from './config/database';
import { initializeSocketIO } from './services';
import { healthRoutes, userRoutes, confessionRoutes, adminRoutes } from './routes';

async function main() {
    console.log('🚀 Starting Bakaiti Backend...');

    // Initialize Firebase Admin
    initializeFirebase();

    // Initialize Redis connection and verify it's ready
    const redis = getRedis();
    try {
        await redis.ping();
        console.log('✅ Redis connection verified');
    } catch (err) {
        console.error('❌ Redis connection failed:', err);
        process.exit(1);
    }

    // Create Express app
    const app = express();

    // Security middleware
    app.use(helmet());

    // CORS - must come before other middleware
    app.use(cors({
        origin: (origin, callback) => {
            const allowedOrigins = config.cors.allowedOrigins;
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                return callback(null, true);
            }
            console.log(`CORS blocked origin: ${origin}`);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing
    app.use(express.json({ limit: '5mb' })); // For image uploads
    app.use(express.urlencoded({ extended: true }));

    // Global Rate Limiting
    app.use(rateLimitMiddleware);

    // Routes
    app.use('/api', healthRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/confessions', confessionRoutes);
    app.use('/api/admin', adminRoutes);

    // 404 handler
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(httpServer);

    // Start server
    httpServer.listen(config.port, () => {
        console.log(`✅ Server running on port ${config.port}`);
        console.log(`📡 Environment: ${config.nodeEnv}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('🛑 SIGTERM received, shutting down...');
        await prisma.$disconnect();
        redis.disconnect();
        httpServer.close();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});
