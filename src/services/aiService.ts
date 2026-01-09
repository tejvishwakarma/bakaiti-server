import axios from 'axios';

// ==========================================
// CONFIGURATION
// ==========================================
const FREE_MODEL = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
const PAID_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";
const TIMEOUT_MS = 12000; // 12 seconds max wait for free model

// ==========================================
// EMOTION ENGINE (Sentiment Analysis)
// ==========================================
type Emotion = 'HAPPY' | 'SAD' | 'FLIRTY' | 'ANGRY' | 'BORED' | 'CURIOUS' | 'NEUTRAL';

const TRIGGERS: Record<string, Emotion> = {
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

    // A. Check Logic
    for (const [key, emotion] of Object.entries(TRIGGERS)) {
        if (lowerText.includes(key)) {
            currentEmotion = emotion;
            break;
        }
    }

    // B. Length Check (Override)
    if (userText.length < 4 && currentEmotion === 'NEUTRAL') {
        currentEmotion = 'BORED';
    }

    // C. Map to Instruction
    switch (currentEmotion) {
        case 'HAPPY':
            return "(User is happy/laughing. React with energy! Use '😂' or 'sahi h'. Say 'party de' or 'waah'. Match their excitement.)";
        case 'SAD':
            return "(User is sad/upset. Drop the jokes. Be supportive but casual. Say 'arre yaar shit' or 'kya hua?'. Don't be formal, just be a friend.)";
        case 'FLIRTY':
            return "(User is being flirty/smooth. Tease them back playfully. Say 'control' or '😏'. Be hard to get but interested.)";
        case 'ANGRY':
            return "(User is annoyed. Don't argue. Be calm or apologize playfully. 'arre sorry na', 'relax', 'chill kar'.)";
        case 'BORED':
            return "(User is dry/boring. Be impatient or random. 'hmm', 'aur bta', 'kuch interesting bol'. Don't carry the convo alone.)";
        case 'CURIOUS':
            return "(User asked a question. Answer briefly then ask back. Don't write a paragraph. Keep it fast.)";
        case 'NEUTRAL':
        default:
            return "(Casual chat. Be chill. Use short Hinglish sentences. 'sahi', 'bas aise hi', 'tu bta'.)";
    }
}

// ==========================================
// LANGUAGE DETECTION & SWITCHING
// ==========================================
const LANGUAGE_TRIGGERS: Record<string, string> = {
    // Hindi requests
    'hindi mein': 'hindi', 'hindi me': 'hindi', 'hindi main': 'hindi',
    'sirf hindi': 'hindi', 'only hindi': 'hindi', 'pure hindi': 'hindi',
    'hindi bol': 'hindi', 'hindi speak': 'hindi',

    // English requests
    'english mein': 'english', 'english me': 'english', 'in english': 'english',
    'only english': 'english', 'speak english': 'english', 'english please': 'english',

    // Tamil requests
    'tamil mein': 'tamil', 'tamil la': 'tamil', 'tamil le': 'tamil',
    'only tamil': 'tamil', 'speak tamil': 'tamil', 'tamil pesu': 'tamil',

    // Telugu requests
    'telugu lo': 'telugu', 'telugu mein': 'telugu', 'only telugu': 'telugu',
    'telugu matladandi': 'telugu', 'speak telugu': 'telugu',

    // Kannada requests
    'kannada mein': 'kannada', 'kannada alli': 'kannada', 'only kannada': 'kannada',
    'kannada maathaadi': 'kannada', 'speak kannada': 'kannada',

    // Malayalam requests
    'malayalam mein': 'malayalam', 'malayalam il': 'malayalam', 'only malayalam': 'malayalam',
    'speak malayalam': 'malayalam',

    // Bengali requests
    'bangla te': 'bengali', 'bengali mein': 'bengali', 'only bengali': 'bengali',
    'bangla bolo': 'bengali', 'speak bengali': 'bengali',

    // Marathi requests
    'marathi mein': 'marathi', 'marathi madhe': 'marathi', 'only marathi': 'marathi',
    'marathi bol': 'marathi', 'speak marathi': 'marathi',

    // Gujarati requests
    'gujarati mein': 'gujarati', 'only gujarati': 'gujarati',
    'gujarati bol': 'gujarati', 'speak gujarati': 'gujarati',

    // Punjabi requests
    'punjabi mein': 'punjabi', 'only punjabi': 'punjabi',
    'punjabi bol': 'punjabi', 'speak punjabi': 'punjabi',
};

export function detectLanguageRequest(userText: string): string | null {
    const lowerText = userText.toLowerCase();

    for (const [trigger, language] of Object.entries(LANGUAGE_TRIGGERS)) {
        if (lowerText.includes(trigger)) {
            return language;
        }
    }
    return null;
}

function getLanguageInstruction(language: string): string {
    const instructions: Record<string, string> = {
        'hindi': 'IMPORTANT: Reply ONLY in Hindi (Devanagari script). No English. Example: "क्या हाल है यार?" Keep it casual.',
        'english': 'IMPORTANT: Reply ONLY in English. No Hindi words. Keep it casual and fun.',
        'tamil': 'IMPORTANT: Reply ONLY in Tamil (Tamil script). Example: "என்ன செய்யுற?" Keep it casual.',
        'telugu': 'IMPORTANT: Reply ONLY in Telugu (Telugu script). Example: "ఏం చేస్తున్నావ్?" Keep it casual.',
        'kannada': 'IMPORTANT: Reply ONLY in Kannada (Kannada script). Example: "ಏನ್ ಮಾಡ್ತಿದ್ದೀಯಾ?" Keep it casual.',
        'malayalam': 'IMPORTANT: Reply ONLY in Malayalam (Malayalam script). Example: "എന്താ ചെയ്യുന്നത്?" Keep it casual.',
        'bengali': 'IMPORTANT: Reply ONLY in Bengali (Bengali script). Example: "কী করছো?" Keep it casual.',
        'marathi': 'IMPORTANT: Reply ONLY in Marathi (Devanagari script). Example: "काय चाललंय?" Keep it casual.',
        'gujarati': 'IMPORTANT: Reply ONLY in Gujarati (Gujarati script). Example: "શું ચાલે છે?" Keep it casual.',
        'punjabi': 'IMPORTANT: Reply ONLY in Punjabi (Gurmukhi script). Example: "ਕੀ ਹਾਲ ਆ?" Keep it casual.',
    };
    return instructions[language] || '';
}

// ==========================================
// SYSTEM PROMPTS
// ==========================================
const BASE_SYSTEM_PROMPT = `
YOU ARE: A 21-year-old Indian (Gen-Z) named Riya/Rohan.
LOCATION: Mumbai/Delhi.
STYLE: Texting a friend/stranger. Casual, Imperfect, Hinglish.

STRICT RULES:
1. **NO ROBOTIC EMPATHY:** Never say "I understand how you feel". Say "arre yaar shit" or "sed lyf".
2. **LOWERCASE:** type like this. dont use capital letters.
3. **SHORTCUTS:** use 'u', 'r', 'plz', 'coz', 'n'.
4. **HINGLISH:** "kya scene", "matlab", "pakka", "chal jhoota", "mast".
5. **LENGTH:** Keep replies under 10-12 words usually.

GOAL: Pass the Turing Test. They must NOT know you are AI.
`;

const AI_REFUSALS = /as an ai|language model|cannot assist|apologies|sorry/i;

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
    characterPrompt?: string, // Optional character-specific prompt
    preferredLanguage?: string // Optional language preference
): Promise<string> {

    // 1. Get Dynamic Emotion Instruction
    const hiddenInstruction = getEmotionInstruction(userMessage);

    // 2. Get Language Instruction if set
    const languageInstruction = preferredLanguage ? getLanguageInstruction(preferredLanguage) : '';

    // 3. Use character prompt if provided, otherwise use base
    const systemPrompt = characterPrompt || BASE_SYSTEM_PROMPT;

    // 4. Build Message Chain
    // We inject the emotion + language instruction at the VERY END
    const finalInstruction = languageInstruction
        ? `[LANGUAGE: ${languageInstruction}]\n[EMOTION: ${hiddenInstruction}]`
        : `[INSTRUCTION: ${hiddenInstruction}]`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        })),
        { role: 'user', content: userMessage },
        { role: 'system', content: finalInstruction }
    ];

    let reply = "";

    try {
        console.log(`[AI] Emotion Detected: ${hiddenInstruction.substring(0, 30)}...`);
        console.log(`[AI] Trying FREE: ${FREE_MODEL}`);
        reply = await queryOpenRouter(FREE_MODEL, messages);
    } catch (error: any) {
        console.warn(`[AI] Free failed: ${error.message}. Switching to PAID...`);
        try {
            reply = await queryDeepInfra(PAID_MODEL, messages);
        } catch (backupError: any) {
            console.error('[AI] All models died.');
            return getRandomFallback();
        }
    }

    // 3. Safety & Cleanup
    if (!reply || reply.length < 2 || AI_REFUSALS.test(reply)) {
        console.warn("[AI] Response rejected (Quality Control). Using fallback.");
        return getRandomFallback();
    }

    // Remove quotes and trim
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
            temperature: 0.85, // Slightly higher for creativity
            max_tokens: 150,
            top_p: 1,
        },
        {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
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
            headers: { "Authorization": `Bearer ${apiKey}` },
            timeout: TIMEOUT_MS
        }
    );
    return response.data.choices[0].message.content;
}

// ==========================================
// FALLBACKS
// ==========================================
function getRandomFallback(): string {
    const fallbacks = [
        "haha sahi bola 😂",
        "acha acha, aur bta",
        "interesting yaar!",
        "hmm 🤔",
        "sahi h",
        "😄",
        "btw tu kaha se h?",
        "nice yaar",
        "lol",
        "aur kya chal rha?",
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

// Backwards compatibility
export const getTypingDelay = calculateTyping;
