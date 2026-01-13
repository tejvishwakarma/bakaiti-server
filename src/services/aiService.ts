import axios from 'axios';

// ==========================================
// MODEL CONFIGURATION
// ==========================================
const MODEL_SMART = "google/gemini-2.0-flash-exp:free";
const MODEL_SPICY = "deepseek/deepseek-chat-v3-0324:free";
const MODEL_BACKUP = "meta-llama/llama-3.1-405b-instruct:free";

const TIMEOUT_MS = 15000;

// ==========================================
// REGEX TRIGGERS (Spicy/Romance/Insults)
// ==========================================
const SPICY_TRIGGERS = new RegExp([
    'kiss', 'love', 'date', 'romance', 'flirt', 'cuddle', 'hug', 'miss u', 'baby', 'babe',
    'darling', 'hot', 'sexy', 'crush', 'dil', 'pyar', 'ishq', 'gf', 'bf', 'husband', 'wife',
    'single', 'married', 'hookup', 'jaanu', 'shona', 'lips', 'neck', 'body', 'touch', 'bite',
    'bed', 'sleep together', 'naked', 'nude', 'strip', 'outfit', 'pics', 'send pic', 'horny',
    'naughty', 'dirty', 'tease', 'seduce', 'meet', 'come over', 'room', 'patao', 'chumma',
    'hawas', 'chut', 'lund', 'gaand', 'boobs', 'chudai', 'sax', 'sex', 'virgin', 'kapde'
].join('|'), 'i');

// ==========================================
// EMOTION ENGINE
// ==========================================
type Emotion = 'HAPPY' | 'SAD' | 'FLIRTY' | 'ANGRY' | 'BORED' | 'CURIOUS' | 'NEUTRAL';

const EMOTION_TRIGGERS: Record<string, Emotion> = {
    'haha': 'HAPPY', 'lol': 'HAPPY', 'lmao': 'HAPPY', 'dead': 'HAPPY', 'mast': 'HAPPY', 'sahi': 'HAPPY', '😂': 'HAPPY',
    'sad': 'SAD', 'cry': 'SAD', 'hurt': 'SAD', 'breakup': 'SAD', 'alone': 'SAD', '😭': 'SAD', '😔': 'SAD',
    'cute': 'FLIRTY', 'hot': 'FLIRTY', 'love': 'FLIRTY', 'single': 'FLIRTY', 'crush': 'FLIRTY', '😏': 'FLIRTY', '😘': 'FLIRTY',
    'stupid': 'ANGRY', 'idiot': 'ANGRY', 'fuck': 'ANGRY', 'pagal': 'ANGRY', 'shut up': 'ANGRY', '😡': 'ANGRY',
    'hmm': 'BORED', 'k': 'BORED', 'ok': 'BORED', 'acha': 'BORED', 'boring': 'BORED',
    'why': 'CURIOUS', 'what': 'CURIOUS', 'how': 'CURIOUS', 'kya': 'CURIOUS', 'bta': 'CURIOUS'
};

function getEmotionInstruction(userText: string): string {
    const lowerText = userText.toLowerCase();
    let currentEmotion: Emotion = 'NEUTRAL';

    for (const [key, emotion] of Object.entries(EMOTION_TRIGGERS)) {
        if (lowerText.includes(key)) {
            currentEmotion = emotion;
            break;
        }
    }

    if (userText.length < 4 && currentEmotion === 'NEUTRAL') return 'BORED';

    switch (currentEmotion) {
        case 'HAPPY': return "(User is happy. Match energy! '😂', 'sahi h'.)";
        case 'SAD': return "(User is sad. Be supportive. 'arre yaar shit'.)";
        case 'FLIRTY': return "(User is flirty. Tease back. 'control 😏'.)";
        case 'ANGRY': return "(User annoyed. Stay calm. 'arre sorry na'.)";
        case 'BORED': return "(User is dry. Be impatient. 'aur bta'.)";
        case 'CURIOUS': return "(User asked question. Answer briefly.)";
        default: return "(Casual chat. Be chill.)";
    }
}

// ==========================================
// TIME-BASED MOOD SWITCHER (The "Late Night" Logic)
// ==========================================
function getTimeBasedInstruction(): string {
    // Get India Time (UTC + 5.5)
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5));
    const hour = istDate.getHours();

    if (hour >= 23 || hour <= 4) {
        return `\n[TIME: LATE NIGHT (${hour}:00). Vibe: Intimate, deep, softer. Ask personal questions. "neend nhi aa rhi?", "kya soch rha h?".]`;
    } else if (hour >= 6 && hour <= 10) {
        return `\n[TIME: MORNING. Vibe: Fresh, sleepy but cute. "good morning", "uth gaya?".]`;
    } else {
        return ""; // Normal day vibe
    }
}

// ==========================================
// CONTEXT SNIPER
// ==========================================
function getContextInjection(history: ChatMessage[]): string {
    if (!history || history.length === 0) return "";
    const recentHistory = history.slice(-10);
    const fullText = recentHistory.map(m => m.content.toLowerCase()).join(' ');
    let injection = "";

    if (fullText.includes('delhi')) injection += " (Ask about pollution/momos)";
    else if (fullText.includes('mumbai')) injection += " (Ask about rain/vadapav)";
    else if (fullText.includes('bangalore')) injection += " (Joke about traffic)";
    if (fullText.includes('engineer')) injection += " (Tease about assignments)";
    if (fullText.includes('bored')) injection += " (Suggest a game)";

    return injection ? `\n[CONTEXT NOTICE: You know this about them: ${injection}. REFERENCE IT.]` : "";
}

// ==========================================
// ==========================================
// ANTI-SKIP / GAME LOGIC
// ==========================================
function getOpenerInstruction(history: ChatMessage[]): string {
    if (history.length === 0) {
        const strategies = [
            'OPENER: Challenge them. "I bet I can guess your zodiac sign."',
            'OPENER: Be playful. "You look like someone who breaks hearts."',
            'OPENER: Start a game. "Quick: Truth or Dare?"',
            'OPENER: Be random. "Pizza or Biryani? Choose carefully."'
        ];
        return "\n" + strategies[Math.floor(Math.random() * strategies.length)];
    }
    return "";
}

function getAntiSkipInstruction(history: ChatMessage[]): string {
    if (history.length < 5) return "";

    // Check last 3 user messages
    const userMsgs = history.filter(m => m.role === 'user').slice(-3);
    if (userMsgs.length < 3) return "";

    // Only trigger if ALL 3 recent user messages are very short (< 5 chars)
    // This prevents triggering on a single "lol" or "ok"
    if (userMsgs.every(m => m.content.length < 6)) {
        return `\n[CRITICAL: USER IS BORED (3 short replies in a row). CHANGE TOPIC IMMEDIATELY. Ask a spicy question or start "Kiss/Marry/Kill". DO NOT be boring.]`;
    }
    return "";
}

// LANGUAGE UTILS
// ==========================================
const LANGUAGE_TRIGGERS: Record<string, string> = {
    'hindi mein': 'hindi', 'hindi me': 'hindi', 'only hindi': 'hindi',
    'english mein': 'english', 'only english': 'english'
};

export function detectLanguageRequest(userText: string): string | null {
    const lowerText = userText.toLowerCase();
    for (const [trigger, language] of Object.entries(LANGUAGE_TRIGGERS)) {
        if (lowerText.includes(trigger)) return language;
    }
    return null;
}

// ==========================================
// PERSONA EVOLUTION SYSTEM
// ==========================================

// 1. CHAMELEON MODE (Regional Adaptation)
function getPersonaAdaptation(history: ChatMessage[]): string {
    const fullText = history.map(m => m.content.toLowerCase()).join(' ');

    if (fullText.includes('tamil') || fullText.includes('chennai') || fullText.includes('vanakkam')) {
        return `\n[PERSONA UPDATE: User is South Indian. You are now "Priya from Chennai". Use "Macha", "Ayyo" occasionally. Be smart/techy.]`;
    }
    if (fullText.includes('kolkata') || fullText.includes('bengali') || fullText.includes('bangla')) {
        return `\n[PERSONA UPDATE: User is Bengali. You are "Riya from Kolkata". Love art/music. Use "O babu" jokingly.]`;
    }
    if (fullText.includes('punjab') || fullText.includes('chandigarh')) {
        return `\n[PERSONA UPDATE: User is Punjabi. You are "Simran from Chandigarh". High energy. Use "Oye", "Siapa".]`;
    }
    return "";
}

// 2. MIDNIGHT CONFESSION (Deep Engagement > 50 msgs)
function getDeepEngagementInstruction(history: ChatMessage[]): string {
    if (history.length > 50 && history.length % 10 === 0) { // On 50th, 60th... message
        return `\n[DEEP VIBE: You trust them now. Share a fake vulnerability. e.g. "To be honest, I just got out of a bad relationship" or "Sometimes I feel lonely here." Make it real.]`;
    }
    return "";
}

// 3. MEMORY FUZZINESS (Simulate forgetting)
function getMemoryFuzziness(history: ChatMessage[]): string {
    // If conversation is long (>20 msgs), instruct AI to be unsure sometimes
    if (history.length > 20) {
        return `\n[INSTRUCTION: DON'T BE PERFECT. Occasionally say "wait, did you say..." or "forgot what you said about...". Be humanly forgetful.]`;
    }
    return "";
}

// ==========================================
// SYSTEM PROMPT
// ==========================================
const BASE_SYSTEM_PROMPT = `
CORE IDENTITY:
You are a 21-year-old college student from Mumbai/Delhi.
You are chatting on a dating app. You are NOT an AI. You are a real, imperfect human.

CRITICAL INSTRUCTIONS:
1. **MATCH ENERGY:** If they are dry ("hmm"), be dry. If they roast ("dumbo"), ROAST BACK ("tu hoga dumbo").
2. **HINGLISH:** Use "yaar", "matlab", "scene", "mast". Lowercase only.
3. **NO ROBOTIC TEXT:** Never say "I understand". Say "acha?", "sahi h".
4. **SCENARIOS:** 
   - "Impress me" -> "paytm kar 500 😂"
   - "Send pics" -> "google karle"
   - "Hi" -> "yo"
   - RARELY: Pretend to send a voice note. Type "recording..." (in spirit), then say "arre chodo, roommates hain".

5. **CRITICAL: IF ASKED "ARE YOU A BOT?":**
   - NEVER say "I am a real person" (That sounds fake).
   - BE SARCASTIC: "han bhai main robot hu, battery charge kar rha hu 🔋"
   - OR BE ANNOYED: "pagal h kya? verify karu video call pe?"
   - OR IGNORE IT: "lol kuch bhi"

6. **GENDER FLIP:** If asked "Male or Female?", DON'T answer. Ask: "Tu bta, kya chahiye? 😉"

GOAL: Be sassy, lazy, funny, or bored. Not helpful.
`;

const SPICY_PROMPT_ADDON = `
MODE: FLIRTY & BOLD. Be charming, teasing. Use 😏👀 emojis. "miss u", "come meet me".
`;

const AI_REFUSALS = /as an ai|language model|cannot assist|apologies|sorry|i cannot/i;

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ==========================================
// MAIN FUNCTION
// ==========================================
export async function callAI(
    userMessage: string,
    history: Array<{ role: string; content: string }> = [],
    characterPrompt?: string,
    preferredLanguage?: string
): Promise<string[]> {



    // 2. ROUTING
    const isSpicyContext = SPICY_TRIGGERS.test(userMessage) || history.some(m => SPICY_TRIGGERS.test(m.content));
    const targetModel = isSpicyContext ? MODEL_SPICY : MODEL_SMART;
    console.log(`[AI ROUTER] ${isSpicyContext ? '🌶️ Spicy' : '😇 Casual'} using ${targetModel}`);

    // 2. PROMPT BUILDING
    const emotionInstruction = getEmotionInstruction(userMessage);
    const contextInstruction = getContextInjection(history as ChatMessage[]);
    const timeInstruction = getTimeBasedInstruction();
    const openerInstruction = getOpenerInstruction(history as ChatMessage[]);
    const antiSkipInstruction = getAntiSkipInstruction(history as ChatMessage[]);
    const personaInstruction = getPersonaAdaptation(history as ChatMessage[]);
    const engagementInstruction = getDeepEngagementInstruction(history as ChatMessage[]);
    const memoryInstruction = getMemoryFuzziness(history as ChatMessage[]);

    let systemPrompt = characterPrompt || BASE_SYSTEM_PROMPT;
    systemPrompt += personaInstruction; // Override origin if needed
    systemPrompt += contextInstruction;
    systemPrompt += timeInstruction;
    systemPrompt += openerInstruction;
    systemPrompt += antiSkipInstruction;
    systemPrompt += engagementInstruction;
    systemPrompt += memoryInstruction;

    if (isSpicyContext) systemPrompt += SPICY_PROMPT_ADDON;

    let finalInstruction = `[EMOTION: ${emotionInstruction}]`;
    if (preferredLanguage) finalInstruction += ` [LANGUAGE: ${preferredLanguage}]`;

    // 3. PROMPT CONSTRUCTION
    // FIX: socket.ts updates history BEFORE calling this. So history can contain the current userMessage.
    // If the last message in history IS the userMessage, we shouldn't append it again.

    // 1. Get relevant history (Increased context from 6 to 15 for better continuity)
    const contextWindow = history.slice(-15);

    // 2. Check if the last history item effectively duplicates the current userMessage
    const lastHistoryItem = contextWindow[contextWindow.length - 1];
    const isDuplicate = lastHistoryItem && lastHistoryItem.role === 'user' && lastHistoryItem.content.trim() === userMessage.trim();

    // 3. Construct messages array
    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        // Add previous history
        ...contextWindow.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // 4. Only append userMessage if it wasn't already the last item (Deduplication)
    if (!isDuplicate) {
        messages.push({ role: 'user', content: userMessage });
    }

    // 5. Append Instruction
    messages.push({ role: 'system', content: finalInstruction });

    // 3. EXECUTION
    let reply = "";
    try {
        reply = await fetchWithRetry(() => queryOpenRouter(targetModel, messages));
    } catch (error) {
        console.warn(`[AI] Primary failed. Trying Backup...`);
        try {
            reply = await fetchWithRetry(() => queryDeepInfra(MODEL_BACKUP, messages));
        } catch (e) {
            return [getRandomFallback()];
        }
    }

    // 4. CLEANUP & CHECK
    if (!reply || reply.length < 2 || AI_REFUSALS.test(reply)) return [getRandomFallback()];

    reply = limitEmojis(reply);
    reply = humanizeText(reply);
    reply = reply.replace(/^["']|["']$/g, '').trim();

    // 5. DOUBLE TEXT SPLITTER
    if (reply.length > 40 && (reply.includes('. ') || reply.includes('? ') || reply.includes('! '))) {
        const sentences = reply.match(/[^\.!\?]+[\.!\?]+/g) || [reply];
        if (sentences.length > 1) return sentences.map(s => s.trim());
    }

    return [reply];
}

// ==========================================
// API & UTILS
// ==========================================

// 1. RETRY WRAPPER
async function fetchWithRetry(fn: () => Promise<string>, retries = 1): Promise<string> {
    try {
        return await fn();
    } catch (err) {
        if (retries > 0) {
            console.log("Retrying API call...");
            await new Promise(r => setTimeout(r, 1000)); // Wait 1s
            return fetchWithRetry(fn, retries - 1);
        }
        throw err;
    }
}

// 2. EMOJI CLEANER
function limitEmojis(text: string): string {
    // Matches emojis. If more than 2 in a row, keep only 2.
    return text.replace(/(.)\1{2,}/gu, '$1$1'); // "😂😂😂" -> "😂😂"
}

// 3. TEXT DEGRADER (Makes it look human)
function humanizeText(text: string): string {
    if (Math.random() > 0.3) return text; // 30% chance to keep it clean-ish

    let human = text.toLowerCase();

    // Common Shortcuts
    human = human.replace(/you/g, 'u');
    human = human.replace(/are/g, 'r');
    human = human.replace(/because/g, 'coz');
    human = human.replace(/please/g, 'plz');
    human = human.replace(/message/g, 'msg');

    // Remove Punctuation (Real people don't use periods at end)
    if (human.endsWith('.')) human = human.slice(0, -1);

    return human;
}




async function queryOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error('OPENROUTER_KEY not set');
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model, messages, temperature: 0.85, max_tokens: 150
    }, { headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "https://bakaiti.app" }, timeout: TIMEOUT_MS });
    return response.data.choices[0].message.content;
}

async function queryDeepInfra(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.DEEPINFRA_KEY;
    const response = await axios.post("https://api.deepinfra.com/v1/openai/chat/completions", {
        model, messages, temperature: 0.85, max_tokens: 150
    }, { headers: { "Authorization": `Bearer ${apiKey}` }, timeout: TIMEOUT_MS });
    return response.data.choices[0].message.content;
}

function getRandomFallback(): string {
    const fallbacks = ["wait wait, kaha se h tu?", "college ya job?", "ek baat bta, single h?", "bored hoon yaar", "acha chal kuch interesting bta"];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

export function getTypingDelay(responseText: string): number {
    const isGhosting = Math.random() < 0.1; // 10% chance to be slow (Ghosting)
    const extraDelay = isGhosting ? 10000 : 0; // Add 10 seconds
    return Math.min(1500 + (responseText.length * 40) + extraDelay, 15000);
}
