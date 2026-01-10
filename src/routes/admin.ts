import express from 'express';
import prisma from '../config/database';
import { authMiddleware } from '../middleware';

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req: any, res: any, next: any) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========================
// CONFESSION MANAGEMENT
// ========================

// GET /api/admin/confessions - List all confessions with author details
router.get('/confessions', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '20', status } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const confessions = await prisma.confession.findMany({
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        photoUrl: true,
                        isBanned: true,
                    }
                },
                _count: {
                    select: {
                        reactions: true,
                        comments: true,
                        reports: true,
                    }
                }
            }
        });

        const total = await prisma.confession.count();

        res.json({
            confessions,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get confessions error:', error);
        res.status(500).json({ error: 'Failed to fetch confessions' });
    }
});

// DELETE /api/admin/confessions/:id - Delete a confession
router.delete('/confessions/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.confession.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Confession deleted' });
    } catch (error) {
        console.error('Delete confession error:', error);
        res.status(500).json({ error: 'Failed to delete confession' });
    }
});

// ========================
// COMMENT MANAGEMENT
// ========================

// GET /api/admin/comments - List all comments with author details
router.get('/comments', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const comments = await prisma.confessionComment.findMany({
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                        photoUrl: true,
                        isBanned: true,
                    }
                },
                confession: {
                    select: {
                        id: true,
                        content: true,
                    }
                },
                _count: {
                    select: {
                        reports: true,
                    }
                }
            }
        });

        const total = await prisma.confessionComment.count();

        res.json({
            comments,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// DELETE /api/admin/comments/:id - Delete a comment
router.delete('/comments/:id', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.confessionComment.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Comment deleted' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ========================
// USER MANAGEMENT
// ========================

// GET /api/admin/users - List all users
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '20', banned } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where = banned === 'true' ? { isBanned: true } : {};

        const users = await prisma.user.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                displayName: true,
                photoUrl: true,
                isAdmin: true,
                isBanned: true,
                bannedAt: true,
                banReason: true,
                createdAt: true,
                _count: {
                    select: {
                        confessions: true,
                        confessionComments: true,
                        reportsMade: true,
                    }
                }
            }
        });

        const total = await prisma.user.count({ where });

        res.json({
            users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/admin/users/:id/ban - Ban a user
router.post('/users/:id/ban', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.id;

        await prisma.user.update({
            where: { id },
            data: {
                isBanned: true,
                bannedAt: new Date(),
                bannedBy: adminId,
                banReason: reason || 'Violated community guidelines'
            }
        });

        res.json({ success: true, message: 'User banned' });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Failed to ban user' });
    }
});

// POST /api/admin/users/:id/unban - Unban a user
router.post('/users/:id/unban', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.user.update({
            where: { id },
            data: {
                isBanned: false,
                bannedAt: null,
                bannedBy: null,
                banReason: null
            }
        });

        res.json({ success: true, message: 'User unbanned' });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: 'Failed to unban user' });
    }
});

// ========================
// REPORT MANAGEMENT
// ========================

// GET /api/admin/reports - List all reports
router.get('/reports', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { page = '1', limit = '20', status = 'PENDING' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where = status ? { status: status as any } : {};

        const reports = await prisma.report.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: 'desc' },
            include: {
                reporter: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    }
                },
                confession: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                email: true,
                                displayName: true,
                            }
                        }
                    }
                },
                comment: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                displayName: true,
                            }
                        }
                    }
                }
            }
        });

        const total = await prisma.report.count({ where });

        res.json({
            reports,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// POST /api/admin/reports/:id/resolve - Resolve a report
router.post('/reports/:id/resolve', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution, status } = req.body;
        const adminId = req.user?.id;

        await prisma.report.update({
            where: { id },
            data: {
                status: status || 'RESOLVED',
                resolvedAt: new Date(),
                resolvedBy: adminId,
                resolution
            }
        });

        res.json({ success: true, message: 'Report resolved' });
    } catch (error) {
        console.error('Resolve report error:', error);
        res.status(500).json({ error: 'Failed to resolve report' });
    }
});

// ========================
// DASHBOARD STATS
// ========================

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            bannedUsers,
            totalConfessions,
            totalComments,
            pendingReports,
            todayConfessions
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isBanned: true } }),
            prisma.confession.count(),
            prisma.confessionComment.count(),
            prisma.report.count({ where: { status: 'PENDING' } }),
            prisma.confession.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            })
        ]);

        res.json({
            totalUsers,
            bannedUsers,
            totalConfessions,
            totalComments,
            pendingReports,
            todayConfessions
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
