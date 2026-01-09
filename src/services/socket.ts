import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import config from '../config';
import { verifyFirebaseToken } from '../config/firebase';
import prisma from '../config/database';
import getRedis, { redisKeys } from '../config/redis';
import { User } from '@prisma/client';
import { callAI, getTypingDelay, detectLanguageRequest } from './aiService';
import { generateGhostProfile, getConversationStarter, buildCharacterPrompt, GhostProfile, GhostCharacter } from '../utils/ghostProfiles';

interface AuthenticatedSocket extends Socket {
    user?: User;
}

interface SessionData {
    user1Id: string;
    user2Id: string;
    startedAt: number;
    moodTheme: string;
    isGhostSession?: boolean;
    ghostProfile?: GhostProfile;
}

// Ghost session storage (in-memory for now, could be Redis)
const ghostSessions: Map<string, {
    ghostProfile: GhostProfile;
    chatHistory: Array<{ role: string; content: string }>;
    preferredLanguage?: string; // Store language preference per session
}> = new Map();

// Pending match timeouts - will trigger ghost match after 30s
const pendingMatchTimeouts: Map<string, NodeJS.Timeout> = new Map();
const AI_MATCH_TIMEOUT_MS = 30000; // 30 seconds

// Available mood themes
const MOOD_THEMES = [
    'ocean', 'sunset', 'forest', 'night', 'sunrise',
    'lavender', 'coral', 'arctic', 'desert', 'aurora'
];

/**
 * Start a timeout for ghost matching - will match user with AI if no real match found
 */
function startGhostMatchTimeout(
    socket: AuthenticatedSocket,
    user: User,
    userMood: string,
    io: SocketIOServer
) {
    // Clear any existing timeout for this user
    const existingTimeout = pendingMatchTimeouts.get(user.id);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    console.log(`⏱️ Starting ${AI_MATCH_TIMEOUT_MS / 1000}s ghost match timeout for ${user.id}`);

    const timeout = setTimeout(async () => {
        try {
            const redis = getRedis();

            // Check if user is still in queue (not matched yet)
            const queueKey = redisKeys.matchQueue();
            const position = await redis.lpos(queueKey, user.id);

            if (position === null) {
                // User already matched, ignore
                console.log(`👻 Ghost timeout expired but user ${user.id} already matched`);
                pendingMatchTimeouts.delete(user.id);
                return;
            }

            // Remove from queue
            await redis.lrem(queueKey, 0, user.id);
            await redis.lrem(`matching_queue:mood:${userMood}`, 0, user.id);

            // Create ghost session
            console.log(`👻 Creating ghost match for user ${user.id}`);

            const ghostProfile = generateGhostProfile(userMood);
            const sessionId = `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const moodTheme = MOOD_THEMES[Math.floor(Math.random() * MOOD_THEMES.length)];

            const sessionData: SessionData = {
                user1Id: user.id,
                user2Id: ghostProfile.id,
                startedAt: Date.now(),
                moodTheme,
                isGhostSession: true,
                ghostProfile
            };

            // Store session in Redis
            await redis.set(
                redisKeys.session(sessionId),
                JSON.stringify(sessionData),
                'EX',
                1800 // 30 min TTL
            );

            // Store ghost session data for message handling
            ghostSessions.set(sessionId, {
                ghostProfile,
                chatHistory: []
            });

            // Join socket to session room
            socket.join(sessionId);

            // Store active session for user
            await redis.set(redisKeys.userSession(user.id), sessionId, 'EX', 1800);

            // Notify user of match
            socket.emit('match_found', {
                sessionId,
                moodTheme,
                yourMood: userMood,
                partnerMood: ghostProfile.mood,
                isSameMood: userMood === ghostProfile.mood || userMood === 'random',
                partner: {
                    displayName: ghostProfile.displayName,
                    photoUrl: ghostProfile.photoUrl,
                }
            });

            console.log(`👻 Ghost session created: ${sessionId} (${ghostProfile.displayName})`);

            // Send initial greeting after a short delay (like a real person)
            setTimeout(async () => {
                // Use character personality for greeting
                const greeting = ghostProfile.character
                    ? getConversationStarter(ghostProfile.character)
                    : `heyyy! kya scene h? 😄`;

                // Emit typing indicator
                socket.emit('partner_typing', { isTyping: true });

                // Wait for "typing" then send message
                setTimeout(() => {
                    socket.emit('partner_typing', { isTyping: false });
                    socket.emit('new_message', {
                        sessionId,
                        senderId: ghostProfile.id,
                        message: greeting,
                        timestamp: Date.now(),
                    });

                    // Add to chat history
                    const ghostSession = ghostSessions.get(sessionId);
                    if (ghostSession) {
                        ghostSession.chatHistory.push({ role: 'assistant', content: greeting });
                    }
                }, getTypingDelay(greeting.length));
            }, 2000 + Math.random() * 2000); // 2-4 seconds delay before first message

            pendingMatchTimeouts.delete(user.id);
        } catch (error) {
            console.error('Ghost match timeout error:', error);
            pendingMatchTimeouts.delete(user.id);
        }
    }, AI_MATCH_TIMEOUT_MS);

    pendingMatchTimeouts.set(user.id, timeout);
}

export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: config.cors.allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 20000,
        pingInterval: 25000,
    });

    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const token = socket.handshake.auth.token;
            console.log('🔐 Socket auth attempt, token length:', token?.length || 0);

            if (!token) {
                console.log('❌ No token provided');
                return next(new Error('Authentication required'));
            }

            const decodedToken = await verifyFirebaseToken(token);
            console.log('🔐 Token decoded:', decodedToken ? `uid=${decodedToken.uid}` : 'null');

            if (!decodedToken) {
                console.log('❌ Token verification failed');
                return next(new Error('Invalid token'));
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
                console.log('👤 User not found, creating new user...');
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

            if (user.bannedUntil && user.bannedUntil > new Date()) {
                console.log('❌ User banned until:', user.bannedUntil);
                return next(new Error('Account suspended'));
            }

            console.log('✅ Socket auth successful for:', user.email);
            socket.user = user;
            next();
        } catch (error) {
            console.error('Socket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', async (socket: AuthenticatedSocket) => {
        const user = socket.user!;
        const redis = getRedis();

        console.log(`🔌 User connected: ${user.email} (${socket.id})`);

        // Store user's socket ID in Redis
        await redis.set(redisKeys.userOnline(user.id), socket.id, 'EX', 300);

        // Send user info to client
        socket.emit('connected', {
            userId: user.id,
            displayName: user.displayName,
            points: user.points,
        });

        // ==========================
        // MATCHING EVENTS
        // ==========================

        socket.on('start_matching', async (data: { mood?: string } = {}) => {
            try {
                const userMood = data.mood || 'random';
                console.log(`🎭 User ${user.id} started matching with mood: ${userMood}`);

                // Check for active penalty
                const penaltyUntil = await redis.get(redisKeys.penalty(user.id));
                if (penaltyUntil && parseInt(penaltyUntil) > Date.now()) {
                    socket.emit('error', {
                        type: 'penalty',
                        message: 'You are in cooldown period',
                        until: parseInt(penaltyUntil)
                    });
                    return;
                }

                // TODO: Re-enable for production - 24h match history check
                // const matchHistoryKey = redisKeys.matchHistory(user.id);
                // const recentlyMatched = await redis.smembers(matchHistoryKey);
                const recentlyMatched: string[] = []; // Disabled for testing

                // Refresh user's online status (prevents stale key after idle)
                await redis.set(redisKeys.userOnline(user.id), socket.id, 'EX', 300);

                // Store user's current mood for matching
                await redis.set(`user:${user.id}:mood`, userMood, 'EX', 300);

                // Add to matching queue
                const queueKey = redisKeys.matchQueue();
                const moodQueueKey = `matching_queue:mood:${userMood}`;

                // Check if already in queue
                const existingPosition = await redis.lpos(queueKey, user.id);
                if (existingPosition !== null) {
                    socket.emit('matching_status', { status: 'already_in_queue' });
                    return;
                }

                // Try to find a match - first from same mood queue, then general queue
                let matchedUserId: string | null = null;
                const skippedUsers: string[] = [];
                const skippedMoodUsers: string[] = [];

                // Phase 1: Try mood-specific queue (except for 'random' which goes straight to general)
                if (userMood !== 'random') {
                    while (true) {
                        const candidateId = await redis.lpop(moodQueueKey);
                        if (!candidateId) break;

                        if (candidateId === user.id) {
                            skippedMoodUsers.push(candidateId);
                            continue;
                        }

                        // Verify candidate is still online
                        const candidateOnline = await redis.get(redisKeys.userOnline(candidateId));
                        if (!candidateOnline) {
                            continue; // Skip offline users
                        }

                        // Complementary matching: vent -> listeners, etc.
                        // For now, same mood matches same mood
                        matchedUserId = candidateId;
                        console.log(`🎭 Mood match found: ${user.id} <-> ${candidateId} (mood: ${userMood})`);
                        break;
                    }

                    // Put back skipped mood users
                    if (skippedMoodUsers.length > 0) {
                        await redis.lpush(moodQueueKey, ...skippedMoodUsers.reverse());
                    }
                }

                // Phase 2: Try general queue if no mood match
                if (!matchedUserId) {
                    while (true) {
                        const candidateId = await redis.lpop(queueKey);
                        if (!candidateId) break;

                        if (candidateId === user.id) {
                            skippedUsers.push(candidateId);
                            continue;
                        }

                        // Verify candidate is still online
                        const candidateOnline = await redis.get(redisKeys.userOnline(candidateId));
                        if (!candidateOnline) {
                            continue; // Skip offline users
                        }

                        matchedUserId = candidateId;
                        console.log(`🎲 Random match found: ${user.id} <-> ${candidateId}`);
                        break;
                    }

                    // Put back skipped users to the front of queue
                    if (skippedUsers.length > 0) {
                        await redis.lpush(queueKey, ...skippedUsers.reverse());
                    }
                }

                if (matchedUserId) {
                    // Found a match!
                    const matchedSocketId = await redis.get(redisKeys.userOnline(matchedUserId));

                    if (matchedSocketId) {
                        // Create session
                        const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const moodTheme = MOOD_THEMES[Math.floor(Math.random() * MOOD_THEMES.length)];

                        const sessionData: SessionData = {
                            user1Id: matchedUserId,
                            user2Id: user.id,
                            startedAt: Date.now(),
                            moodTheme,
                        };

                        await redis.set(
                            redisKeys.session(sessionId),
                            JSON.stringify(sessionData),
                            'EX',
                            1800 // 30 min TTL
                        );

                        // Store match history for both users (24h TTL = 86400 seconds)
                        const historyTTL = 86400;
                        await redis.sadd(redisKeys.matchHistory(user.id), matchedUserId);
                        await redis.expire(redisKeys.matchHistory(user.id), historyTTL);
                        await redis.sadd(redisKeys.matchHistory(matchedUserId), user.id);
                        await redis.expire(redisKeys.matchHistory(matchedUserId), historyTTL);

                        // Join both users to session room
                        socket.join(sessionId);
                        const matchedSocket = io.sockets.sockets.get(matchedSocketId);
                        matchedSocket?.join(sessionId);

                        // Store active session for both users (for disconnect handling)
                        await redis.set(redisKeys.userSession(user.id), sessionId, 'EX', 1800);
                        await redis.set(redisKeys.userSession(matchedUserId), sessionId, 'EX', 1800);

                        // Fetch both users' profiles for partner info
                        const [currentUserProfile, matchedUserProfile] = await Promise.all([
                            prisma.user.findUnique({
                                where: { id: user.id },
                                select: { displayName: true, photoUrl: true }
                            }),
                            prisma.user.findUnique({
                                where: { id: matchedUserId },
                                select: { displayName: true, photoUrl: true }
                            })
                        ]);

                        // Get matched user's mood
                        const matchedUserMood = await redis.get(`user:${matchedUserId}:mood`) || 'random';
                        const isSameMood = userMood === matchedUserMood || userMood === 'random' || matchedUserMood === 'random';

                        // Notify current user with matched user's info as partner
                        socket.emit('match_found', {
                            sessionId,
                            moodTheme,
                            yourMood: userMood,
                            partnerMood: matchedUserMood,
                            isSameMood,
                            partner: {
                                displayName: matchedUserProfile?.displayName || 'Partner',
                                photoUrl: matchedUserProfile?.photoUrl || null,
                            }
                        });

                        // Notify matched user with current user's info as partner
                        matchedSocket?.emit('match_found', {
                            sessionId,
                            moodTheme,
                            yourMood: matchedUserMood,
                            partnerMood: userMood,
                            isSameMood,
                            partner: {
                                displayName: currentUserProfile?.displayName || 'Partner',
                                photoUrl: currentUserProfile?.photoUrl || null,
                            }
                        });

                        console.log(`✨ Match created: ${sessionId}`);
                        // Clear any pending ghost match timeout
                        const pendingTimeout = pendingMatchTimeouts.get(user.id);
                        if (pendingTimeout) {
                            clearTimeout(pendingTimeout);
                            pendingMatchTimeouts.delete(user.id);
                        }
                    } else {
                        // Matched user disconnected, add self to both queues
                        if (userMood !== 'random') {
                            await redis.rpush(moodQueueKey, user.id);
                        }
                        await redis.rpush(queueKey, user.id);
                        socket.emit('matching_status', { status: 'searching', mood: userMood });
                        // Start ghost match timeout
                        startGhostMatchTimeout(socket, user, userMood, io);
                    }
                } else {
                    // No valid match found, add self to mood queue and general queue
                    if (userMood !== 'random') {
                        await redis.rpush(moodQueueKey, user.id);
                    }
                    await redis.rpush(queueKey, user.id);
                    socket.emit('matching_status', { status: 'searching', mood: userMood });
                    // Start ghost match timeout
                    startGhostMatchTimeout(socket, user, userMood, io);
                }
            } catch (error) {
                console.error('Start matching error:', error);
                socket.emit('error', { message: 'Failed to start matching' });
            }
        });

        socket.on('stop_matching', async () => {
            try {
                const redis = getRedis();
                await redis.lrem(redisKeys.matchQueue(), 0, user.id);
                socket.emit('matching_status', { status: 'stopped' });
            } catch (error) {
                console.error('Stop matching error:', error);
            }
        });

        // ==========================
        // CHAT EVENTS
        // ==========================

        socket.on('send_message', async (data: { sessionId: string; message: string }) => {
            try {
                const { sessionId, message } = data;

                if (!message || typeof message !== 'string' || message.length > 1000) {
                    socket.emit('error', { message: 'Invalid message' });
                    return;
                }

                // Verify session exists and user is part of it
                const sessionData = await redis.get(redisKeys.session(sessionId));
                if (!sessionData) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }

                const session: SessionData = JSON.parse(sessionData);
                if (session.user1Id !== user.id && session.user2Id !== user.id) {
                    socket.emit('error', { message: 'Not in this session' });
                    return;
                }

                // Broadcast message to session (including sender for confirmation)
                io.to(sessionId).emit('new_message', {
                    sessionId,
                    senderId: user.id,
                    message: message.trim(),
                    timestamp: Date.now(),
                });

                // Handle ghost session - generate AI response
                if (session.isGhostSession) {
                    const ghostSession = ghostSessions.get(sessionId);
                    if (ghostSession) {
                        const ghostProfile = ghostSession.ghostProfile;

                        // Detect language switch request
                        const detectedLanguage = detectLanguageRequest(message);
                        if (detectedLanguage) {
                            ghostSession.preferredLanguage = detectedLanguage;
                            console.log(`[AI] Language switched to: ${detectedLanguage}`);
                        }

                        // Add user message to history
                        ghostSession.chatHistory.push({ role: 'user', content: message.trim() });

                        // Show typing indicator
                        socket.emit('partner_typing', { isTyping: true });

                        // Generate AI response with character personality
                        try {
                            // Build character-specific prompt if character exists
                            const characterPrompt = ghostProfile.character
                                ? buildCharacterPrompt(ghostProfile.character)
                                : undefined;

                            const aiResponse = await callAI(
                                message.trim(),
                                ghostSession.chatHistory,
                                characterPrompt,
                                ghostSession.preferredLanguage // Pass language preference
                            );

                            // Calculate human-like delay
                            const delay = getTypingDelay(aiResponse.length);

                            setTimeout(() => {
                                socket.emit('partner_typing', { isTyping: false });
                                socket.emit('new_message', {
                                    sessionId,
                                    senderId: ghostProfile.id,
                                    message: aiResponse,
                                    timestamp: Date.now(),
                                });

                                // Add AI response to history
                                ghostSession.chatHistory.push({ role: 'assistant', content: aiResponse });
                            }, delay);
                        } catch (aiError) {
                            console.error('AI response error:', aiError);
                            socket.emit('partner_typing', { isTyping: false });
                        }
                    }

                    // Skip emoji detection for ghost sessions
                    await redis.expire(redisKeys.session(sessionId), 1800);
                    return;
                }


                // Same Vibe detection - extract emojis and check for match
                const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu;
                const emojis = message.match(emojiRegex);

                if (emojis && emojis.length > 0) {
                    const emoji = emojis[0]; // Use first emoji
                    const partnerId = session.user1Id === user.id ? session.user2Id : session.user1Id;

                    // Check if partner sent same emoji recently (within 5s)
                    const partnerEmojiKey = redisKeys.recentEmoji(sessionId, partnerId);
                    const partnerRecentEmoji = await redis.get(partnerEmojiKey);

                    if (partnerRecentEmoji === emoji) {
                        // Same Vibe! 🎉
                        console.log(`🎵 Same Vibe detected! Both sent: ${emoji}`);
                        io.to(sessionId).emit('same_vibe', {
                            emoji,
                            timestamp: Date.now(),
                        });
                        // Clear both users' emoji cache
                        await redis.del(partnerEmojiKey);
                        await redis.del(redisKeys.recentEmoji(sessionId, user.id));
                    } else {
                        // Store this user's emoji for 5 seconds
                        await redis.set(
                            redisKeys.recentEmoji(sessionId, user.id),
                            emoji,
                            'EX',
                            5
                        );
                    }
                }

                // Refresh session TTL
                await redis.expire(redisKeys.session(sessionId), 1800);
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Image message with expiry
        socket.on('send_image', async (data: { sessionId: string; imageUrl: string; expirySeconds?: number }) => {
            try {
                const { sessionId, imageUrl, expirySeconds = 30 } = data;

                // Verify session
                const sessionData = await redis.get(redisKeys.session(sessionId));
                if (!sessionData) {
                    socket.emit('error', { message: 'Session not found' });
                    return;
                }

                const session: SessionData = JSON.parse(sessionData);
                if (session.user1Id !== user.id && session.user2Id !== user.id) {
                    socket.emit('error', { message: 'Not in this session' });
                    return;
                }

                const timestamp = Date.now();
                const expiresAt = timestamp + (expirySeconds * 1000);

                // Broadcast image message to session
                io.to(sessionId).emit('new_message', {
                    sessionId,
                    senderId: user.id,
                    message: '[Image]',
                    type: 'image',
                    imageUrl,
                    expiresAt,
                    timestamp,
                });

                console.log(`📸 Image sent to session ${sessionId}, expires in ${expirySeconds}s`);

                // Refresh session TTL
                await redis.expire(redisKeys.session(sessionId), 1800);
            } catch (error) {
                console.error('Send image error:', error);
                socket.emit('error', { message: 'Failed to send image' });
            }
        });

        socket.on('typing', async (data: { sessionId: string; isTyping: boolean }) => {
            try {
                const { sessionId, isTyping } = data;
                socket.to(sessionId).emit('partner_typing', { isTyping });
            } catch (error) {
                console.error('Typing indicator error:', error);
            }
        });

        // Ghost message - sync with partner
        socket.on('ghost_message', async (data: { sessionId: string; messageIndex: number; isGhosted: boolean }) => {
            try {
                const { sessionId, messageIndex, isGhosted } = data;
                socket.to(sessionId).emit('message_ghosted', {
                    messageIndex,
                    isGhosted,
                    ghostedBy: user.id,
                });
            } catch (error) {
                console.error('Ghost message error:', error);
            }
        });

        // React to message - sync with partner
        socket.on('react_message', async (data: { sessionId: string; messageIndex: number; emoji: string | null }) => {
            try {
                const { sessionId, messageIndex, emoji } = data;
                socket.to(sessionId).emit('message_reaction', {
                    messageIndex,
                    emoji,
                    reactedBy: user.id,
                });
            } catch (error) {
                console.error('React message error:', error);
            }
        });

        // ==========================
        // MOOD LIGHTING SYNC
        // ==========================

        // Propose a theme change to partner
        socket.on('propose_theme', async (data: { sessionId: string; theme: string }) => {
            try {
                const { sessionId, theme } = data;
                console.log(`🌈 Theme proposal: ${theme} in session ${sessionId}`);
                socket.to(sessionId).emit('theme_proposed', {
                    theme,
                    proposedBy: user.id,
                });
            } catch (error) {
                console.error('Propose theme error:', error);
            }
        });

        // Accept theme proposal
        socket.on('accept_theme', async (data: { sessionId: string; theme: string }) => {
            try {
                const { sessionId, theme } = data;
                console.log(`✅ Theme accepted: ${theme} in session ${sessionId}`);

                // Update session with new theme
                const sessionData = await redis.get(redisKeys.session(sessionId));
                if (sessionData) {
                    const session: SessionData = JSON.parse(sessionData);
                    session.moodTheme = theme;
                    await redis.set(redisKeys.session(sessionId), JSON.stringify(session), 'EX', 1800);
                }

                // Notify both users
                io.to(sessionId).emit('theme_changed', {
                    theme,
                    acceptedBy: user.id,
                });
            } catch (error) {
                console.error('Accept theme error:', error);
            }
        });

        // Reject theme proposal
        socket.on('reject_theme', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                console.log(`❌ Theme rejected in session ${sessionId}`);
                socket.to(sessionId).emit('theme_rejected', {
                    rejectedBy: user.id,
                });
            } catch (error) {
                console.error('Reject theme error:', error);
            }
        });

        // ==========================
        // WORD BOMB MINI-GAME
        // ==========================

        // Start a Word Bomb game
        socket.on('start_word_bomb', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;

                // Generate random letter (weighted towards common letters)
                const commonLetters = 'ABCDEFGHILMNOPRSTW';
                const letter = commonLetters[Math.floor(Math.random() * commonLetters.length)];

                // Store game state in Redis (15 second TTL)
                const gameKey = `wordbomb:${sessionId}`;
                await redis.set(gameKey, JSON.stringify({
                    letter,
                    startedBy: user.id,
                    startedAt: Date.now(),
                    answered: false,
                }), 'EX', 20);

                console.log(`💣 Word Bomb started in ${sessionId}: Letter ${letter}`);

                // Broadcast to session
                io.to(sessionId).emit('word_bomb_started', {
                    letter,
                    startedBy: user.id,
                    timeLimit: 15,
                });
            } catch (error) {
                console.error('Start word bomb error:', error);
            }
        });

        // Answer Word Bomb
        socket.on('word_bomb_answer', async (data: { sessionId: string; answer: string }) => {
            try {
                const { sessionId, answer } = data;

                const gameKey = `wordbomb:${sessionId}`;
                const gameData = await redis.get(gameKey);

                if (!gameData) {
                    socket.emit('word_bomb_error', { message: 'No active game' });
                    return;
                }

                const game = JSON.parse(gameData);

                if (game.answered) {
                    socket.emit('word_bomb_error', { message: 'Already answered' });
                    return;
                }

                // Validate: word must start with the letter and be 3+ chars
                const trimmedAnswer = answer.trim().toUpperCase();
                if (trimmedAnswer.length >= 3 && trimmedAnswer.startsWith(game.letter)) {
                    // Winner!
                    game.answered = true;
                    game.winnerId = user.id;
                    game.winningWord = trimmedAnswer;
                    await redis.set(gameKey, JSON.stringify(game), 'EX', 5);

                    console.log(`🏆 Word Bomb winner: ${user.id} with "${trimmedAnswer}"`);

                    io.to(sessionId).emit('word_bomb_won', {
                        winnerId: user.id,
                        word: trimmedAnswer,
                        letter: game.letter,
                    });
                } else {
                    // Wrong answer
                    socket.emit('word_bomb_wrong', {
                        message: `"${answer}" doesn't start with ${game.letter} or is too short`,
                    });
                }
            } catch (error) {
                console.error('Word bomb answer error:', error);
            }
        });

        // ==========================
        // SESSION HEARTBEAT
        // ==========================

        socket.on('session_ping', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                const redis = getRedis();

                // Check if session still exists
                const sessionData = await redis.get(redisKeys.session(sessionId));

                if (sessionData) {
                    socket.emit('session_pong', { valid: true, sessionId });
                } else {
                    console.log(`⚠️ Dead session detected: ${sessionId}`);
                    socket.emit('session_pong', { valid: false, sessionId });
                }
            } catch (error) {
                console.error('Session ping error:', error);
                socket.emit('session_pong', { valid: false });
            }
        });

        // ==========================
        // AUDIO/VIDEO CALLING (WebRTC Signaling)
        // ==========================

        // Request a call (audio or video)
        socket.on('call_request', async (data: { sessionId: string; callType: 'audio' | 'video' }) => {
            try {
                const { sessionId, callType } = data;
                console.log(`📞 Call request: ${callType} in session ${sessionId} from ${user.email}`);

                // Forward to partner in session
                socket.to(sessionId).emit('incoming_call', {
                    callType,
                    callerId: user.id,
                    callerName: user.displayName || 'User',
                });
            } catch (error) {
                console.error('Call request error:', error);
            }
        });

        // Accept incoming call
        socket.on('call_accept', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                console.log(`✅ Call accepted in session ${sessionId}`);
                socket.to(sessionId).emit('call_accepted');
            } catch (error) {
                console.error('Call accept error:', error);
            }
        });

        // Reject incoming call
        socket.on('call_reject', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                console.log(`❌ Call rejected in session ${sessionId}`);
                socket.to(sessionId).emit('call_rejected');
            } catch (error) {
                console.error('Call reject error:', error);
            }
        });

        // WebRTC offer (SDP)
        socket.on('webrtc_offer', async (data: { sessionId: string; offer: any }) => {
            try {
                const { sessionId, offer } = data;
                // Validate offer structure (basic SDP validation)
                if (!offer || typeof offer !== 'object' || !offer.type || !offer.sdp) {
                    console.error('❌ Invalid WebRTC offer structure');
                    return;
                }
                socket.to(sessionId).emit('webrtc_offer', { offer });
            } catch (error) {
                console.error('WebRTC offer error:', error);
            }
        });

        // WebRTC answer (SDP)
        socket.on('webrtc_answer', async (data: { sessionId: string; answer: any }) => {
            try {
                const { sessionId, answer } = data;
                // Validate answer structure (basic SDP validation)
                if (!answer || typeof answer !== 'object' || !answer.type || !answer.sdp) {
                    console.error('❌ Invalid WebRTC answer structure');
                    return;
                }
                socket.to(sessionId).emit('webrtc_answer', { answer });
            } catch (error) {
                console.error('WebRTC answer error:', error);
            }
        });

        // WebRTC ICE candidate
        socket.on('webrtc_ice', async (data: { sessionId: string; candidate: any }) => {
            try {
                const { sessionId, candidate } = data;
                // Validate ICE candidate structure
                if (!candidate || typeof candidate !== 'object') {
                    console.error('❌ Invalid WebRTC ICE candidate structure');
                    return;
                }
                socket.to(sessionId).emit('webrtc_ice', { candidate });
            } catch (error) {
                console.error('WebRTC ICE error:', error);
            }
        });

        // End call
        socket.on('call_end', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                console.log(`📵 Call ended in session ${sessionId}`);
                socket.to(sessionId).emit('call_ended');
            } catch (error) {
                console.error('Call end error:', error);
            }
        });

        // ==========================
        // SKIP/END SESSION
        // ==========================

        socket.on('skip', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                const redis = getRedis();

                // Get session data
                const sessionData = await redis.get(redisKeys.session(sessionId));
                if (sessionData) {
                    const session: SessionData = JSON.parse(sessionData);

                    // Clear userSession for both users
                    await redis.del(redisKeys.userSession(session.user1Id));
                    await redis.del(redisKeys.userSession(session.user2Id));

                    // Notify partner
                    socket.to(sessionId).emit('partner_skipped');

                    // Leave room
                    socket.leave(sessionId);

                    // Delete session
                    await redis.del(redisKeys.session(sessionId));
                    console.log(`⏭️ Session ${sessionId} skipped by ${user.email}`);
                }

                // Track skip count for penalties
                const skipKey = redisKeys.skipCount(user.id);
                const skipCount = await redis.incr(skipKey);

                if (skipCount === 1) {
                    await redis.expire(skipKey, 60); // 60 second window
                }

                // Check for penalty
                if (skipCount >= 3) {
                    const penaltyDuration = 5 * 60 * 1000; // 5 minutes
                    const penaltyUntil = Date.now() + penaltyDuration;
                    await redis.set(redisKeys.penalty(user.id), penaltyUntil.toString(), 'EX', 300);

                    socket.emit('penalty_applied', {
                        type: 'rapid_skip',
                        until: penaltyUntil,
                        duration: penaltyDuration,
                    });

                    console.log(`⚠️ Penalty applied to ${user.email} for rapid skipping`);
                }

                socket.emit('session_ended', { reason: 'you_skipped' });
            } catch (error) {
                console.error('Skip error:', error);
                socket.emit('error', { message: 'Failed to skip' });
            }
        });

        socket.on('end_chat', async (data: { sessionId: string }) => {
            try {
                const { sessionId } = data;
                const redis = getRedis();

                // Get session data to clear both users' session keys
                const sessionData = await redis.get(redisKeys.session(sessionId));
                if (sessionData) {
                    const session: SessionData = JSON.parse(sessionData);
                    // Clear userSession for both users
                    await redis.del(redisKeys.userSession(session.user1Id));
                    await redis.del(redisKeys.userSession(session.user2Id));
                }

                // Notify partner
                socket.to(sessionId).emit('partner_left');

                // Leave room and delete session
                socket.leave(sessionId);
                await redis.del(redisKeys.session(sessionId));

                socket.emit('session_ended', { reason: 'you_ended' });
                console.log(`🔚 Session ${sessionId} ended by ${user.email}`);
            } catch (error) {
                console.error('End chat error:', error);
            }
        });

        // ==========================
        // DISCONNECT HANDLING
        // ==========================

        socket.on('disconnect', async () => {
            console.log(`🔌 User disconnected: ${user.email}`);

            try {
                // Remove from queue
                await redis.lrem(redisKeys.matchQueue(), 0, user.id);

                // Remove online status
                await redis.del(redisKeys.userOnline(user.id));

                // Get user's active session from Redis (more reliable than socket.rooms)
                const sessionId = await redis.get(redisKeys.userSession(user.id));

                if (sessionId) {
                    console.log(`📤 User ${user.email} was in session ${sessionId}`);

                    // Get session data
                    const sessionData = await redis.get(redisKeys.session(sessionId));
                    if (sessionData) {
                        const session: SessionData = JSON.parse(sessionData);

                        // Find partner ID
                        const partnerId = session.user1Id === user.id ? session.user2Id : session.user1Id;

                        // Get partner's socket ID and notify
                        const partnerSocketId = await redis.get(redisKeys.userOnline(partnerId));
                        if (partnerSocketId) {
                            const partnerSocket = io.sockets.sockets.get(partnerSocketId);
                            if (partnerSocket) {
                                console.log(`📤 Notifying partner ${partnerId} that partner disconnected`);
                                partnerSocket.emit('partner_disconnected', {
                                    reason: 'connection_lost',
                                });
                            }
                        }

                        // Delete session
                        await redis.del(redisKeys.session(sessionId));
                        console.log(`🗑️ Session ${sessionId} deleted due to disconnect`);
                    }

                    // Clear user's session tracking
                    await redis.del(redisKeys.userSession(user.id));
                }
            } catch (error) {
                console.error('Disconnect cleanup error:', error);
            }
        });
    });

    console.log('✅ Socket.IO initialized');
    return io;
}

export default initializeSocketIO;
