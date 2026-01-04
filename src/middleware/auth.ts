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

        // Find user by googleId first, then by email (in case of account re-creation)
        let user = await prisma.user.findUnique({
            where: { googleId: decodedToken.uid }
        });

        if (!user && decodedToken.email) {
            // Check if user exists with same email (re-login after account deletion)
            user = await prisma.user.findUnique({
                where: { email: decodedToken.email }
            });

            if (user) {
                // Update the googleId to the new Firebase UID
                user = await prisma.user.update({
                    where: { email: decodedToken.email },
                    data: {
                        googleId: decodedToken.uid,
                        displayName: decodedToken.name || user.displayName,
                        photoUrl: decodedToken.picture || user.photoUrl,
                    }
                });
                console.log('🔄 User googleId updated for:', user.email);
            }
        }

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
