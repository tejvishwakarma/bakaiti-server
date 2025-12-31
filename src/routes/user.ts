import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware';
import prisma from '../config/database';

const router = Router();

// Get user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        // Update last login and streak
        const now = new Date();
        const lastLogin = user.lastLoginAt;
        let newStreak = user.dailyLoginStreak;

        if (lastLogin) {
            const hoursSinceLastLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastLogin >= 24 && hoursSinceLastLogin < 48) {
                // Logged in next day - increment streak
                newStreak = Math.min(newStreak + 1, 7);
            } else if (hoursSinceLastLogin >= 48) {
                // Missed a day - reset streak
                newStreak = 1;
            }
            // Same day - don't change streak
        } else {
            // First login ever
            newStreak = 1;
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: now,
                dailyLoginStreak: newStreak,
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                photoUrl: true,
                points: true,
                subscriptionStatus: true,
                subscriptionExpiresAt: true,
                dailyLoginStreak: true,
                createdAt: true,
            }
        });

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update display name
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { displayName } = req.body;

        if (typeof displayName !== 'string' || displayName.length > 50) {
            res.status(400).json({ error: 'Invalid display name' });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user!.id },
            data: { displayName: displayName.trim() },
            select: {
                id: true,
                displayName: true,
            }
        });

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get user inventory
router.get('/me/inventory', authMiddleware, async (req: Request, res: Response) => {
    try {
        const inventory = await prisma.inventory.findMany({
            where: { userId: req.user!.id },
            select: {
                itemType: true,
                itemId: true,
                acquiredAt: true,
            }
        });

        res.json({ inventory });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Failed to get inventory' });
    }
});

// Delete account
router.delete('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        await prisma.user.delete({
            where: { id: req.user!.id }
        });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Reward points for watching ad
router.post('/me/points/ad-reward', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const now = new Date();
        const POINTS_PER_AD = 50;
        const MAX_ADS_PER_DAY = 10;

        // Check if ads counter should reset (new day)
        const adsResetAt = user.adsResetAt;
        let adsWatchedToday = user.totalAdsWatchedToday;

        if (!adsResetAt || now.toDateString() !== adsResetAt.toDateString()) {
            // New day - reset counter
            adsWatchedToday = 0;
        }

        // Check daily limit
        if (adsWatchedToday >= MAX_ADS_PER_DAY) {
            res.status(429).json({
                error: 'Daily ad limit reached',
                adsWatchedToday,
                maxAdsPerDay: MAX_ADS_PER_DAY,
            });
            return;
        }

        // Award points
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                points: { increment: POINTS_PER_AD },
                totalAdsWatchedToday: adsWatchedToday + 1,
                adsResetAt: now,
            },
            select: {
                points: true,
                totalAdsWatchedToday: true,
            }
        });

        console.log(`🎬 User ${user.id} watched ad, earned ${POINTS_PER_AD} points`);

        res.json({
            pointsEarned: POINTS_PER_AD,
            totalPoints: updatedUser.points,
            adsWatchedToday: updatedUser.totalAdsWatchedToday,
            adsRemaining: MAX_ADS_PER_DAY - updatedUser.totalAdsWatchedToday,
        });
    } catch (error) {
        console.error('Ad reward error:', error);
        res.status(500).json({ error: 'Failed to reward points' });
    }
});

export default router;
