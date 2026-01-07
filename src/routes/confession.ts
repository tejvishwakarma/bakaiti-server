import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware';
import prisma from '../config/database';
import { ConfessionCategory } from '@prisma/client';

const router = Router();

// Get all confessions (paginated)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const category = req.query.category as string | undefined;

        const whereClause = category && category !== 'all'
            ? { category: category.toUpperCase() as ConfessionCategory }
            : {};

        const [confessions, total] = await Promise.all([
            prisma.confession.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            photoUrl: true,
                        },
                    },
                    reactions: {
                        select: {
                            emoji: true,
                            userId: true,
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                        },
                    },
                },
            }),
            prisma.confession.count({ where: whereClause }),
        ]);

        // Transform data to hide author if anonymous
        const transformedConfessions = confessions.map((confession) => ({
            id: confession.id,
            content: confession.content,
            category: confession.category,
            isAnonymous: confession.isAnonymous,
            author: confession.isAnonymous
                ? { displayName: 'Anonymous', photoUrl: null }
                : confession.author,
            likesCount: confession.likesCount,
            viewsCount: confession.viewsCount,
            commentsCount: confession._count.comments,
            reactions: confession.reactions,
            createdAt: confession.createdAt,
        }));

        res.json({
            confessions: transformedConfessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get confessions error:', error);
        res.status(500).json({ error: 'Failed to fetch confessions' });
    }
});

// Create a new confession
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { content, category = 'RANDOM', isAnonymous = true } = req.body;

        if (!content || typeof content !== 'string' || content.length < 10) {
            return res.status(400).json({ error: 'Confession must be at least 10 characters' });
        }

        if (content.length > 1000) {
            return res.status(400).json({ error: 'Confession must be under 1000 characters' });
        }

        const confession = await prisma.confession.create({
            data: {
                content: content.trim(),
                category: category.toUpperCase() as ConfessionCategory,
                authorId: user.id,
                isAnonymous,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        photoUrl: true,
                    },
                },
            },
        });

        res.status(201).json({
            id: confession.id,
            content: confession.content,
            category: confession.category,
            isAnonymous: confession.isAnonymous,
            author: confession.isAnonymous
                ? { displayName: 'Anonymous', photoUrl: null }
                : confession.author,
            likesCount: 0,
            viewsCount: 0,
            commentsCount: 0,
            reactions: [],
            createdAt: confession.createdAt,
        });
    } catch (error) {
        console.error('Create confession error:', error);
        res.status(500).json({ error: 'Failed to create confession' });
    }
});

// Get single confession with details
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const confession = await prisma.confession.update({
            where: { id },
            data: { viewsCount: { increment: 1 } },
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        photoUrl: true,
                    },
                },
                reactions: {
                    select: {
                        emoji: true,
                        userId: true,
                    },
                },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                    include: {
                        user: {
                            select: {
                                id: true,
                                displayName: true,
                                photoUrl: true,
                            },
                        },
                    },
                },
            },
        });

        if (!confession) {
            return res.status(404).json({ error: 'Confession not found' });
        }

        // Transform comments to hide anonymous authors
        const transformedComments = confession.comments.map((comment) => ({
            id: comment.id,
            content: comment.content,
            isAnonymous: comment.isAnonymous,
            author: comment.isAnonymous
                ? { displayName: 'Anonymous', photoUrl: null }
                : comment.user,
            createdAt: comment.createdAt,
        }));

        res.json({
            id: confession.id,
            content: confession.content,
            category: confession.category,
            isAnonymous: confession.isAnonymous,
            author: confession.isAnonymous
                ? { displayName: 'Anonymous', photoUrl: null }
                : confession.author,
            likesCount: confession.likesCount,
            viewsCount: confession.viewsCount,
            reactions: confession.reactions,
            comments: transformedComments,
            createdAt: confession.createdAt,
        });
    } catch (error) {
        console.error('Get confession error:', error);
        res.status(500).json({ error: 'Failed to fetch confession' });
    }
});

// Add/toggle reaction
router.post('/:id/react', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { id } = req.params;
        const { emoji } = req.body;

        const validEmojis = ['🔥', '😢', '😂', '💔', '🤯', '❤️'];
        if (!emoji || !validEmojis.includes(emoji)) {
            return res.status(400).json({ error: 'Invalid emoji' });
        }

        // Check if reaction exists
        const existingReaction = await prisma.confessionReaction.findUnique({
            where: {
                confessionId_userId: {
                    confessionId: id,
                    userId: user.id,
                },
            },
        });

        if (existingReaction) {
            if (existingReaction.emoji === emoji) {
                // Same emoji - remove reaction
                await prisma.confessionReaction.delete({
                    where: { id: existingReaction.id },
                });
                await prisma.confession.update({
                    where: { id },
                    data: { likesCount: { decrement: 1 } },
                });
                return res.json({ action: 'removed', emoji });
            } else {
                // Different emoji - update
                await prisma.confessionReaction.update({
                    where: { id: existingReaction.id },
                    data: { emoji },
                });
                return res.json({ action: 'updated', emoji });
            }
        }

        // New reaction
        await prisma.confessionReaction.create({
            data: {
                confessionId: id,
                userId: user.id,
                emoji,
            },
        });
        await prisma.confession.update({
            where: { id },
            data: { likesCount: { increment: 1 } },
        });

        res.json({ action: 'added', emoji });
    } catch (error) {
        console.error('React to confession error:', error);
        res.status(500).json({ error: 'Failed to react' });
    }
});

// Add comment
router.post('/:id/comments', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { id } = req.params;
        const { content, isAnonymous = true } = req.body;

        if (!content || typeof content !== 'string' || content.length < 1) {
            return res.status(400).json({ error: 'Comment cannot be empty' });
        }

        if (content.length > 500) {
            return res.status(400).json({ error: 'Comment must be under 500 characters' });
        }

        const comment = await prisma.confessionComment.create({
            data: {
                confessionId: id,
                userId: user.id,
                content: content.trim(),
                isAnonymous,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        photoUrl: true,
                    },
                },
            },
        });

        res.status(201).json({
            id: comment.id,
            content: comment.content,
            isAnonymous: comment.isAnonymous,
            author: comment.isAnonymous
                ? { displayName: 'Anonymous', photoUrl: null }
                : comment.user,
            createdAt: comment.createdAt,
        });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

export default router;
