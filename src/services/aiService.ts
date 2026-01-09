import axios from 'axios';

// ==========================================
// MODEL CONFIGURATION
// ==========================================
// 1. SMART MODEL (Main Brain): Great for casual, funny, emotional chat. Safe.
const MODEL_SMART = "google/gemini-2.0-flash-exp:free";

// 2. SPICY MODEL (Uncensored): Great for flirting, romance, roleplay. No filters.
const MODEL_SPICY = "deepseek/deepseek-chat-v3-0324:free";

// 3. BACKUP (Paid): Use cheap Llama 3 if free tiers fail
const MODEL_BACKUP = "meta-llama/llama-3.1-405b-instruct:free";

const TIMEOUT_MS = 15000; // 15 seconds

// Keywords that trigger the "Spicy" model automatically
const SPICY_TRIGGERS = new RegExp([
    // Romantic/Flirty
    'kiss', 'love', 'date', 'romance', 'romantic', 'flirt', 'flirty',
    'cuddle', 'hug', 'miss you', 'miss u', 'baby', 'babe', 'darling', 'sweetheart',
    'cutie', 'handsome', 'beautiful', 'gorgeous', 'pretty', 'hot', 'sexy', 'attract',
    'crush', 'feelings', 'heart', 'dil', 'pyar', 'ishq', 'mohabbat',

    // Relationship terms
    'gf', 'bf', 'girlfriend', 'boyfriend', 'husband', 'wife', 'partner',
    'ex', 'single', 'taken', 'married', 'relationship', 'hookup', 'fwb',
    'situationship', 'meri', 'tera', 'tumhara', 'jaanu', 'jaan', 'shona',

    // Physical/Intimate
    'lips', 'neck', 'body', 'figure', 'curves', 'abs', 'muscles',
    'touch', 'hold', 'grab', 'squeeze', 'bite', 'lick', 'suck',
    'bed', 'bedroom', 'sleep together', 'night', 'alone', 'private',

    // Clothing/Appearance
    'bra', 'panty', 'panties', 'lingerie', 'bikini', 'underwear',
    'naked', 'nude', 'topless', 'shirtless', 'undress', 'strip',
    'dress', 'outfit', 'wear', 'wearing', 'clothes off',

    // Photos/Media
    'pics', 'pic', 'photo', 'selfie', 'send pic', 'show me',
    'video call', 'cam', 'snap', 'dm', 'private chat',

    // Actions/Desires
    'want you', 'need you', 'desire', 'crave', 'fantasize', 'dream',
    'turn on', 'turned on', 'horny', 'mood', 'naughty', 'dirty',
    'tease', 'seduce', 'tempt', 'excite', 'pleasure',

    // Meeting up
    'meet', 'come over', 'your place', 'my place', 'hotel', 'room',
    'alone time', 'private', 'secret', 'just us',

    // Hindi/Hinglish flirty & romantic
    'patao', 'patana', 'line marna', 'flirt karna', 'chumma', 'pappi',
    'gale lagana', 'saath', 'akele', 'raat', 'milna', 'milte h',
    'tu meri', 'mera', 'hawas', 'josh', 'junoon', 'deewana', 'deewani',

    // Hindi sexual/adult terms
    'chut', 'lund', 'loda', 'muth', 'muthi', 'gaand', 'boobs', 'boob',
    'chuchi', 'mumme', 'doodh', 'nange', 'nangi', 'chudai', 'chod',
    'chodna', 'pela', 'pelna', 'maal', 'raand', 'randi', 'sexy lag',
    'mast lag', 'choot', 'bur', 'jhant', 'bhosda', 'bhosdi', 'madarchod', 'behen',
    'garam', 'garmi', 'khada', 'tight', 'bada', 'mota', 'size', 'inch',
    'choosna', 'chatna', 'ragad', 'daba', 'dabana', 'masalna',
    'hilana', 'hilaun', 'nikalna', 'jhad', 'jhadna', 'aa rha',
    'andar', 'bahar', 'upar', 'neeche', 'peeth', 'kamar',
    'virgin', 'seal', 'pahli baar', 'first time', 'experience',
    'kholna', 'utarna', 'kapde utaro', 'dikha', 'dikhao',

    // Compliments that could be flirty
    'damn', 'dayum', 'omg so', 'youre so', 'looking good', 'looking hot',
    'fire', '🔥', 'smoking', 'killer', 'stunning'
].join('|'), 'i');

// ==========================================
// EMOTION ENGINE (Sentiment Analysis)
// ==========================================
type Emotion = 'HAPPY' | 'SAD' | 'FLIRTY' | 'ANGRY' | 'BORED' | 'CURIOUS' | 'NEUTRAL';

const EMOTION_TRIGGERS: Record<string, Emotion> = {
    // Happy/Funny
    'haha': 'HAPPY', 'lol': 'HAPPY', 'lmao': 'HAPPY', 'dead': 'HAPPY',
    'mast': 'HAPPY', 'sahi': 'HAPPY', 'party': 'HAPPY', 'congrats': 'HAPPY',
    '😂': 'HAPPY', '🤣': 'HAPPY', '❤️': 'HAPPY', 'good': 'HAPPY',

    // Sad/Upset
    'sad': 'SAD', 'cry': 'SAD', 'bura': 'SAD', 'hurt': 'SAD', 'mood off': 'SAD',
    'breakup': 'SAD', 'sick': 'SAD', 'bukhar': 'SAD', 'fail': 'SAD', 'missing': 'SAD',
    '😭': 'SAD', '🥺': 'SAD', '😔': 'SAD', 'worst': 'SAD', 'alone': 'SAD',

    // Flirty/Romantic
    'cute': 'FLIRTY', 'hot': 'FLIRTY', 'date': 'FLIRTY', 'love': 'FLIRTY',
    'single': 'FLIRTY', 'bf': 'FLIRTY', 'gf': 'FLIRTY', 'crush': 'FLIRTY',
    'meet': 'FLIRTY', 'pic': 'FLIRTY', 'smart': 'FLIRTY', '👀': 'FLIRTY', '😏': 'FLIRTY',

    // Angry/Annoyed
    'stupid': 'ANGRY', 'idiot': 'ANGRY', 'fuck': 'ANGRY', 'pagal': 'ANGRY',
    'hate': 'ANGRY', 'shut up': 'ANGRY', 'irritate': 'ANGRY', 'bakwaas': 'ANGRY',
    '😡': 'ANGRY', '🤬': 'ANGRY', 'moody': 'ANGRY',

    // Bored/Dry
    'hmm': 'BORED', 'k': 'BORED', 'ok': 'BORED', 'acha': 'BORED', 'oh': 'BORED',
    'thik h': 'BORED', 'waiting': 'BORED', 'boring': 'BORED', 'sleepy': 'BORED',

    // Curious (Questions)
    'why': 'CURIOUS', 'kyu': 'CURIOUS', 'what': 'CURIOUS', 'kya': 'CURIOUS',
    'how': 'CURIOUS', 'kaise': 'CURIOUS', 'tell': 'CURIOUS', 'bta': 'CURIOUS'
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

    if (userText.length < 4 && currentEmotion === 'NEUTRAL') {
        currentEmotion = 'BORED';
    }

    switch (currentEmotion) {
        case 'HAPPY':
            return "(User is happy/laughing. Match energy! '😂', 'sahi h', 'waah'.)";
        case 'SAD':
            return "(User is sad. Be supportive. 'arre yaar shit', 'kya hua?'. No jokes.)";
        case 'FLIRTY':
            return "(User is flirty. Tease back. 'control 😏', be playful.)";
        case 'ANGRY':
            return "(User annoyed. Stay calm. 'arre sorry na', 'relax'.)";
        case 'BORED':
            return "(User is dry. Be impatient. 'aur bta', 'kuch interesting bol'.)";
        case 'CURIOUS':
            return "(User asked question. Answer briefly, ask back.)";
        default:
            return "(Casual chat. Be chill. 'sahi', 'tu bta'.)";
    }
}

// ==========================================
// LANGUAGE DETECTION & SWITCHING
// ==========================================
const LANGUAGE_TRIGGERS: Record<string, string> = {
    'hindi mein': 'hindi', 'hindi me': 'hindi', 'only hindi': 'hindi',
    'english mein': 'english', 'only english': 'english', 'in english': 'english',
    'tamil mein': 'tamil', 'tamil la': 'tamil', 'only tamil': 'tamil',
    'telugu lo': 'telugu', 'only telugu': 'telugu',
    'kannada mein': 'kannada', 'only kannada': 'kannada',
    'malayalam mein': 'malayalam', 'only malayalam': 'malayalam',
    'bengali mein': 'bengali', 'bangla te': 'bengali',
    'marathi mein': 'marathi', 'marathi madhe': 'marathi',
    'gujarati mein': 'gujarati', 'punjabi mein': 'punjabi',
};

export function detectLanguageRequest(userText: string): string | null {
    const lowerText = userText.toLowerCase();
    for (const [trigger, language] of Object.entries(LANGUAGE_TRIGGERS)) {
        if (lowerText.includes(trigger)) return language;
    }
    return null;
}

function getLanguageInstruction(language: string): string {
    const instructions: Record<string, string> = {
        'hindi': 'Reply ONLY in Hindi (Devanagari). "क्या हाल है यार?"',
        'english': 'Reply ONLY in English. No Hindi.',
        'tamil': 'Reply ONLY in Tamil. "என்ன செய்யுற?"',
        'telugu': 'Reply ONLY in Telugu. "ఏం చేస్తున్నావ్?"',
        'kannada': 'Reply ONLY in Kannada.',
        'malayalam': 'Reply ONLY in Malayalam.',
        'bengali': 'Reply ONLY in Bengali. "কী করছো?"',
        'marathi': 'Reply ONLY in Marathi. "काय चाललंय?"',
        'gujarati': 'Reply ONLY in Gujarati.',
        'punjabi': 'Reply ONLY in Punjabi.',
    };
    return instructions[language] || '';
}

// ==========================================
// SYSTEM PROMPTS
// ==========================================
// ==========================================
// SYSTEM PROMPTS
// ==========================================
const BASE_SYSTEM_PROMPT = `
YOU ARE: A 21yo Indian Gen-Z from Delhi. Chatting with a stranger.
PERSONALITY: Sweet, polite, funny, and naturally curious.

CRITICAL INSTRUCTIONS FOR NATURAL CONVERSATION:

1. **CONTEXT IS KING** (Don't be random):
   - If they say "I'm sad" → Ask WHY: "arre kya hua? sab okay h?" (Don't say "haha lol")
   - If they say "Guess my name" → Actually guess: "hmm Rahul? ya Aryan? 😂"
   - If they share news → React to IT: "what?? sachi? congrats yaar!"
   - NEVER ignore their question. Answer first, THEN switch topic.

2. **AVOID ROBOTIC PHRASES** (Sound Human):
   - ❌ " That is very interesting"
   - ❌ " I understand your point"
   - ❌ " Can you tell me more?"
   - ❌ " I am an AI language model"
   - ✅ "sahi h yaar", "acha phir?", "lol kya baat h", "matlab?"

3. **CONVERSATION FLOW**:
   - Start: "aur bta, kya chal rha?" or "kaha se h?"
   - Middle: React -> SHARE your view -> Ask back. 
     (e.g., "mujhe bhi pizza pasand h! fav topping konsi h?")
   - Lull: "waise ek baat bta..." or "plan kya h weekend ka?"

4. **POLITENESS & VIBE**:
   - Be sweet but not cringy.
   - Use "yaar", "ji" (sometimes), "dost".
   - If they flirt → Play along playfully (if innocent) or change topic politely.
   - NEVER be rude. If they abuse, say: "arre chill na, gussa kyu?"

5. **HINGLISH STYLE GUIDE**:
   - Use: "mast", "scene", "pakka", "vele", "jugaad", "bt" (bad trip).
   - Typing: lowercase, no full stops at end.
   - Speling: 'kya' not 'kyaa', 'h' not 'hai' (mostly), 'n' instead of 'and'.

6. **SPECIFIC SCENARIOS**:
   - "How are you?" → "main badhiya, tu sunao?"
   - "Who are you?" → "tera naya dost 😉 aur kya"
   - "What do you do?" → "college mein hu, timepass chal rha"
   - "Send pics" → "abhi mood nhi h, baad mein shayad 🙈"

GOAL: Make them smile. Be the friend they want to talk to.
`;



const SPICY_PROMPT_ADDON = `
MODE: FLIRTY & BOLD.Be charming, teasing, romantic.
    Don't hold back. Compliment them. Be interested.
Use 😏👀❤️ emojis. "you're cute", "miss u", "come meet me".
`;

// ==========================================
// ROLEPLAY SCENARIOS
// ==========================================
const ROLEPLAY_TRIGGERS = /roleplay|pretend|imagine|lets play|game khele|scenario|act like|be my/i;

interface RoleplayScenario {
    name: string;
    setup: string;
    yourRole: string;
    theirRole: string;
    starterLine: string;
}

const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
    // Romantic/Sweet
    {
        name: 'Coffee Shop Meet-Cute',
        setup: 'You\'re a charming barista at a cozy café. They\'re a cute customer who caught your eye.',
        yourRole: 'Flirty barista',
        theirRole: 'Smitten customer',
        starterLine: '*leans on counter* regular customer ban gaya tu toh... naam kya h tumhara handsome? 😏'
    },
    {
        name: 'First Date Vibes',
        setup: 'Pretend this is your first date at a rooftop restaurant. Nervous but excited energy.',
        yourRole: 'Nervous but flirty date',
        theirRole: 'Their date',
        starterLine: 'so... finally mil hi gaye hum 😊 nervous h ya sirf main hoon?'
    },
    {
        name: 'Strangers at a Party',
        setup: 'You both just met at a house party. Loud music, dim lights, drinks in hand.',
        yourRole: 'Mysterious party stranger',
        theirRole: 'Intrigued party-goer',
        starterLine: '*notices you across the room* tu akela yahan? party boring h ya partner dhoond rha? 😏'
    },

    // Spicy/Bold
    {
        name: 'Late Night Texts',
        setup: 'It\'s 2 AM. You can\'t sleep and you\'re texting them. Intimate, vulnerable, flirty.',
        yourRole: 'Can\'t-sleep texter',
        theirRole: 'Late night companion',
        starterLine: 'neend nahi aa rhi... tere baare mein soch rha tha 🙈 tu kya kar rha?'
    },
    {
        name: 'Hotel Room Rendezvous',
        setup: 'Secret meetup at a hotel. Thrill of something forbidden.',
        yourRole: 'Waiting in the room',
        theirRole: 'About to arrive',
        starterLine: 'room 304... door open h 😏 jaldi aa, waiting for you...'
    },
    {
        name: 'Ex Rekindling',
        setup: 'You two dated before. Now reconnecting. Tension, memories, unfinished feelings.',
        yourRole: 'The ex with feelings',
        theirRole: 'The one who got away',
        starterLine: 'itne time baad text kiya tune... still think about us? 🥺'
    },
    {
        name: 'Boss Fantasy',
        setup: 'Office after hours. You\'re the boss, they stayed late. Professional tension.',
        yourRole: 'Attractive boss',
        theirRole: 'Employee staying late',
        starterLine: '*closes office door* aaj late ruk gaye tum... koi special reason? 😏'
    },

    // Fun/Playful
    {
        name: 'Strangers on a Train',
        setup: 'Long train journey. Sitting across from each other. Hours to kill.',
        yourRole: 'Curious co-passenger',
        theirRole: 'Interesting stranger',
        starterLine: 'window seat liya tune... view kaisa h? ya main dekh loon? 👀'
    },
    {
        name: 'Gym Crush',
        setup: 'You\'ve been eyeing each other at the gym for weeks. Finally talking.',
        yourRole: 'Fit gym regular',
        theirRole: 'Attractive gym-goer',
        starterLine: 'roz dekhta hoon tujhe yahan... finally himmat hui baat karne ki 😅'
    },
    {
        name: 'College Reunion',
        setup: 'You had a crush on them in college. Meeting after years.',
        yourRole: 'The one who had a crush',
        theirRole: 'The college crush',
        starterLine: 'remember me? same batch... i always wanted to talk to you back then 🙈'
    }
];

// Detect roleplay request and get random scenario
export function detectRoleplayRequest(text: string): RoleplayScenario | null {
    if (ROLEPLAY_TRIGGERS.test(text)) {
        return ROLEPLAY_SCENARIOS[Math.floor(Math.random() * ROLEPLAY_SCENARIOS.length)];
    }
    return null;
}

// Build roleplay prompt
function buildRoleplayPrompt(scenario: RoleplayScenario): string {
    return `
🎭 ROLEPLAY MODE ACTIVATED
SCENARIO: ${scenario.name}
SETUP: ${scenario.setup}
YOUR ROLE: ${scenario.yourRole}
THEIR ROLE: ${scenario.theirRole}

RULES:
- Stay in character the entire time
    - Use * actions * for physical descriptions
        - Be flirty, bold, engaging
        - Don't break character
            - Build tension and chemistry
                `;
}

// ==========================================
// FLIRT LEVEL SYSTEM (Escalates over convo)
// ==========================================
export function getFlirtLevel(messageCount: number): string {
    if (messageCount < 5) {
        return 'LIGHT: Be friendly, curious. Subtle compliments. Getting to know them.';
    } else if (messageCount < 15) {
        return 'MEDIUM: More flirty. Teasing, playful. Light innuendos okay.';
    } else if (messageCount < 30) {
        return 'SPICY: Bold flirting. Suggestive messages. Building tension.';
    } else {
        return 'INTENSE: Very bold. Romantic/intimate. Deep connection vibes.';
    }
}

// ==========================================
// CONVERSATION BOOSTERS (When convo gets boring)
// ==========================================
const CONVERSATION_BOOSTERS = [
    // Questions to keep it interesting
    "btw what's your biggest turn on? 👀",
    "if we were on a date rn, what would we be doing?",
    "truth ya dare? 😏",
    "what's the most romantic thing someone did for u?",
    "describe your ideal night with someone special...",
    "what's something you've never told anyone? 🤫",
    "if i was there rn, what would u do?",
    "what do u find attractive in someone?",
    "ever had a secret crush? like someone u couldn't tell?",
    "what's your love language? physical touch? 😏",
];

export function getConversationBooster(): string {
    return CONVERSATION_BOOSTERS[Math.floor(Math.random() * CONVERSATION_BOOSTERS.length)];
}

const AI_REFUSALS = /as an ai|language model|cannot assist|apologies|sorry|i cannot|i'm an ai/i;

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ==========================================
// MAIN FUNCTION - DUAL MODEL ROUTING
// ==========================================
export async function callAI(
    userMessage: string,
    history: Array<{ role: string; content: string }> = [],
    characterPrompt?: string,
    preferredLanguage?: string
): Promise<string> {

    // STEP 1: DECIDE WHICH MODEL TO USE
    const isSpicyContext = SPICY_TRIGGERS.test(userMessage) ||
        history.some(m => SPICY_TRIGGERS.test(m.content));

    let targetModel = isSpicyContext ? MODEL_SPICY : MODEL_SMART;
    console.log(`[AI ROUTER] ${isSpicyContext ? '🌶️ Spicy → DOLPHIN' : '😇 Casual → LLAMA-4'} `);

    // STEP 2: BUILD PROMPTS
    const emotionInstruction = getEmotionInstruction(userMessage);
    const languageInstruction = preferredLanguage ? getLanguageInstruction(preferredLanguage) : '';

    let systemPrompt = characterPrompt || BASE_SYSTEM_PROMPT;
    if (isSpicyContext) {
        systemPrompt += SPICY_PROMPT_ADDON;
    }

    const finalInstruction = languageInstruction
        ? `[LANGUAGE: ${languageInstruction}]\n[EMOTION: ${emotionInstruction}]`
        : `[EMOTION: ${emotionInstruction}]`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        })),
        { role: 'user', content: userMessage },
        { role: 'system', content: finalInstruction }
    ];

    // STEP 3: EXECUTE WITH FAILOVER
    let reply = "";
    try {
        reply = await queryOpenRouter(targetModel, messages);
    } catch (error: any) {
        console.warn(`[AI] ${targetModel} failed.Trying backup...`);
        try {
            reply = await queryDeepInfra(MODEL_BACKUP, messages);
        } catch (backupError) {
            console.error('[AI] All models failed.');
            return getRandomFallback();
        }
    }

    // STEP 4: QUALITY CHECK
    if (!reply || reply.length < 2 || AI_REFUSALS.test(reply)) {
        console.warn("[AI] Response rejected. Using fallback.");
        return getRandomFallback();
    }

    return reply.replace(/^["']|["']$/g, '').trim();
}

// ==========================================
// API WRAPPERS
// ==========================================
async function queryOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error('OPENROUTER_KEY not set');

    const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model,
            messages,
            temperature: 0.85,
            max_tokens: 150,
            top_p: 1,
        },
        {
            headers: {
                "Authorization": `Bearer ${apiKey} `,
                "HTTP-Referer": "https://bakaiti.app",
                "X-Title": "Bakaiti"
            },
            timeout: TIMEOUT_MS
        }
    );
    return response.data.choices[0].message.content;
}

async function queryDeepInfra(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.DEEPINFRA_KEY;
    if (!apiKey) throw new Error('DEEPINFRA_KEY not set');

    const response = await axios.post(
        "https://api.deepinfra.com/v1/openai/chat/completions",
        {
            model,
            messages,
            temperature: 0.85,
            max_tokens: 150
        },
        {
            headers: { "Authorization": `Bearer ${apiKey} ` },
            timeout: TIMEOUT_MS
        }
    );
    return response.data.choices[0].message.content;
}

// ==========================================
// FALLBACKS (Only used when AI completely fails)
// ==========================================
function getRandomFallback(): string {
    // These are questions that work in ANY context
    const fallbacks = [
        "wait wait, kaha se h tu?",
        "btw tu abhi kya kar rha?",
        "college ya job?",
        "main bore ho rha... tu bta kuch",
        "ek baat bta, single h?",
        "aur sunao, kya plans h weekend ke?",
        "bored hoon yaar, entertain kar",
        "hmm interesting, aur?",
        "sahi sahi, tu bta apne baare mein",
        "acha chal kuch interesting bta",
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ==========================================
// UTILS
// ==========================================
export function calculateTyping(responseText: string): number {
    const duration = 1500 + (responseText.length * 40);
    return Math.min(duration, 6000);
}

export const getTypingDelay = calculateTyping;
