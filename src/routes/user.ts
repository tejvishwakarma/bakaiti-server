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

export default router;
