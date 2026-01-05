import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';

import config from './config';
import { initializeFirebase } from './config/firebase';
import getRedis from './config/redis';
import prisma from './config/database';
import { initializeSocketIO } from './services';
import { healthRoutes, userRoutes } from './routes';

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

    // CORS
    app.use(cors({
        origin: config.cors.allowedOrigins,
        credentials: true,
    }));

    // Body parsing
    app.use(express.json({ limit: '5mb' })); // For image uploads
    app.use(express.urlencoded({ extended: true }));

    // Routes
    app.use('/api', healthRoutes);
    app.use('/api/user', userRoutes);

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
