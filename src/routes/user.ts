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

// Update user profile (display name and/or photo)
router.patch('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { displayName, photoUrl } = req.body;
        const updateData: { displayName?: string; photoUrl?: string } = {};

        // Validate and add displayName if provided
        if (displayName !== undefined) {
            if (typeof displayName !== 'string' || displayName.length > 50) {
                res.status(400).json({ error: 'Invalid display name (max 50 characters)' });
                return;
            }
            updateData.displayName = displayName.trim();
        }

        // Validate and add photoUrl if provided
        if (photoUrl !== undefined) {
            if (typeof photoUrl !== 'string' || photoUrl.length > 500) {
                res.status(400).json({ error: 'Invalid photo URL' });
                return;
            }
            updateData.photoUrl = photoUrl;
        }

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: 'No valid fields to update' });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user!.id },
            data: updateData,
            select: {
                id: true,
                displayName: true,
                photoUrl: true,
                email: true,
                points: true,
            }
        });

        console.log(`👤 User ${req.user!.id} updated profile:`, updateData);

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

// Purchase item (theme) and add to inventory
router.post('/me/inventory/purchase', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { itemType, itemId, price } = req.body;
        const user = req.user!;

        // Validate input
        if (!itemType || !itemId || typeof price !== 'number') {
            res.status(400).json({ error: 'Invalid request: itemType, itemId, and price required' });
            return;
        }

        // Check if user has enough points
        if (user.points < price) {
            res.status(400).json({ error: 'Insufficient points', currentPoints: user.points });
            return;
        }

        // Check if already owns this item
        const existing = await prisma.inventory.findFirst({
            where: {
                userId: user.id,
                itemType,
                itemId,
            }
        });

        if (existing) {
            res.status(400).json({ error: 'Item already owned' });
            return;
        }

        // Transaction: deduct points and add to inventory
        const [updatedUser, inventoryItem] = await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { points: { decrement: price } },
                select: { points: true },
            }),
            prisma.inventory.create({
                data: {
                    userId: user.id,
                    itemType,
                    itemId,
                }
            })
        ]);

        console.log(`🛒 User ${user.id} purchased ${itemType}:${itemId} for ${price} points`);

        res.json({
            success: true,
            remainingPoints: updatedUser.points,
            item: {
                itemType: inventoryItem.itemType,
                itemId: inventoryItem.itemId,
                acquiredAt: inventoryItem.acquiredAt,
            }
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Purchase failed' });
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
