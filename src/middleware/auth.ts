import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../config/firebase';
import prisma from '../config/database';
import { User } from '@prisma/client';

// Extend Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
            firebaseUid?: string;
        }
    }
}

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await verifyFirebaseToken(token);

        if (!decodedToken) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }

        // Find or create user
        let user = await prisma.user.findUnique({
            where: { googleId: decodedToken.uid }
        });

        if (!user) {
            // Create new user on first sign-in
            user = await prisma.user.create({
                data: {
                    googleId: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name || null,
                    photoUrl: decodedToken.picture || null,
                }
            });
            console.log('✨ New user created:', user.email);
        }

        // Check if user is banned
        if (user.bannedUntil && user.bannedUntil > new Date()) {
            res.status(403).json({
                error: 'Account suspended',
                bannedUntil: user.bannedUntil
            });
            return;
        }

        req.user = user;
        req.firebaseUid = decodedToken.uid;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

export default authMiddleware;
