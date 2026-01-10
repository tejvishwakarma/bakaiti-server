import axios from 'axios';

// ==========================================
// INTERFACES & CONFIG
// ==========================================
interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ACTUALLY VERIFIED FREE MODELS (Jan 2026) - browsed openrouter.ai/models?q=free
const MODEL_SMART = "openai/gpt-oss-120b:free"; // OpenAI's 117B MoE - best reasoning!
const MODEL_SPICY = "meta-llama/llama-3.3-70b-instruct:free"; // Meta's powerful free model
const MODEL_BACKUP = "google/gemini-2.0-flash-exp:free"; // Google's free experimental
const FALLBACK_MODELS = [
    "google/gemma-3-27b-it:free", // Google Gemma 3
    "deepseek/deepseek-r1-0528:free", // DeepSeek R1
    "mistralai/devstral-2512:free" // Mistral's coding model
];
const TIMEOUT_MS = 30000;

// ==========================================
// CONSTANTS & TRIGGERS
// ==========================================
const SPICY_TRIGGERS = new RegExp([
    'kiss', 'love', 'date', 'romance', 'flirt', 'cuddle', 'hug', 'miss u', 'baby', 'babe',
    'darling', 'hot', 'sexy', 'crush', 'dil', 'pyar', 'ishq', 'gf', 'bf', 'husband', 'wife',
    'single', 'married', 'hookup', 'jaanu', 'shona', 'lips', 'neck', 'body', 'touch', 'bite',
    'bed', 'sleep together', 'naked', 'nude', 'strip', 'outfit', 'pics', 'send pic', 'horny',
    'naughty', 'dirty', 'tease', 'seduce', 'meet', 'come over', 'room', 'patao', 'chumma',
    'hawas', 'chut', 'lund', 'gaand', 'boobs', 'chudai', 'sax', 'sex', 'virgin', 'kapde'
].join('|'), 'i');

const IMAGE_INTENT_REGEX = /(send|show|dikha).*(pic|photo|image|nude|boob|ass|body)/i;
const AI_REFUSALS = /as an ai|language model|cannot assist|apologies|sorry|i cannot/i;

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

// ==========================================
// EMOTION & CONTEXT HELPERS
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

function getTimeBasedInstruction(): string {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const istDate = new Date(utc + (3600000 * 5.5)); // India Time
    const hour = istDate.getHours();

    if (hour >= 23 || hour <= 4) {
        return `\n[TIME: LATE NIGHT (${hour}:00). Vibe: Intimate, deep, softer. Ask personal questions. "neend nhi aa rhi?", "kya soch rha h?".]`;
    } else if (hour >= 6 && hour <= 10) {
        return `\n[TIME: MORNING. Vibe: Fresh, sleepy but cute. "good morning", "uth gaya?".]`;
    } else {
        return "";
    }
}

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
    if (history.length < 3) return "";
    const lastUserMsg = history[history.length - 1].content;
    const secondLastUserMsg = history[history.length - 3]?.content || "";
    if (lastUserMsg.length < 5 && secondLastUserMsg.length < 5) {
        return `\n[CRITICAL: USER IS BORED AND MIGHT SKIP. CHANGE TOPIC IMMEDIATELY. Ask a spicy question or start "Kiss/Marry/Kill". DO NOT be boring.]`;
    }
    return "";
}

// LANGUAGE UTILS
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

function getDeepEngagementInstruction(history: ChatMessage[]): string {
    if (history.length > 50 && history.length % 10 === 0) {
        return `\n[DEEP VIBE: You trust them now. Share a fake vulnerability. e.g. "To be honest, I just got out of a bad relationship" or "Sometimes I feel lonely here." Make it real.]`;
    }
    return "";
}

function getMemoryFuzziness(history: ChatMessage[]): string {
    if (history.length > 20) {
        return `\n[INSTRUCTION: DON'T BE PERFECT. Occasionally say "wait, did you say..." or "forgot what you said about...". Be humanly forgetful.]`;
    }
    return "";
}

// ==========================================
// MAIN EXPORT
// ==========================================
export async function callAI(
    userMessage: string,
    history: Array<{ role: string; content: string }> = [],
    characterPrompt?: string,
    preferredLanguage?: string
): Promise<string[]> {

    // 1. IMAGE GENERATION LOGIC
    if (IMAGE_INTENT_REGEX.test(userMessage)) {
        console.log(`[AI] Checking image intent for: "${userMessage}"`);

        // A. HARD TO GET LOGIC
        try {
            if (shouldRefuseImage(history)) {
                console.log(`[AI] Refusing image request (Hard to Get)`);
                const refusalPrompt = `
                SYSTEM: ${characterPrompt || BASE_SYSTEM_PROMPT}
                TASK: The user asked for a photo/nude.
                INSTRUCTION: REFUSE them playfully but firmly. 
                - Say "no" or "not yet" or "we barely know each other".
                - Be sassy: "slow down tiger", "buy me dinner first".
                - Do NOT say "I cannot" (robot). Say "nah", "mood nhi h".
                `;
                const refusal = await fetchWithRetry(() => queryOpenRouter(MODEL_SPICY, [{ role: 'system', content: refusalPrompt }]));
                return [limitEmojis(humanizeText(refusal))];
            }
        } catch (error) {
            console.error("[AI] Refusal generation failed:", error);
            // Return SINGLE random fallback, not all 3!
            const fallbacks = ["nah not now", "mood nhi h abhi", "slow down tiger 😏"];
            return [fallbacks[Math.floor(Math.random() * fallbacks.length)]];
        }

        // B. GRANT REQUEST
        try {
            const imagePrompt = await generateImagePrompt(userMessage, characterPrompt || "21yo Indian College Girl");
            if (imagePrompt) {
                console.log(`[AI] Granting Image: ${imagePrompt}`);

                const [imageUrl, caption] = await Promise.all([
                    generateStableDiffusionImage(imagePrompt),
                    fetchWithRetry(() => queryOpenRouter(MODEL_SPICY, [{
                        role: 'system',
                        content: `
                        SYSTEM: ${characterPrompt || BASE_SYSTEM_PROMPT}
                        TASK: You are sending a photo of: "${imagePrompt}".
                        INSTRUCTION: Write a 1-sentence caption for this photo.
                        - Be playful/flirty. 
                        - Examples: "don't stare too much 😉", "felt force might delete later", "here u go".
                        - NO hashtags. Lowercase.
                        `
                    }])).catch(e => "here u go") // Fallback caption
                ]);

                if (imageUrl) {
                    return [caption || "here u go", `[IMAGE_URL:${imageUrl}]`];
                }
            }
        } catch (error) {
            console.error("[AI] Image Granting logic failed:", error);
        }
    }

    // 2. ROUTING
    const isSpicyContext = SPICY_TRIGGERS.test(userMessage) || history.some(m => SPICY_TRIGGERS.test(m.content));
    const targetModel = isSpicyContext ? MODEL_SPICY : MODEL_SMART;
    console.log(`[AI ROUTER] ${isSpicyContext ? '🌶️ Spicy' : '😇 Casual'} using ${targetModel}`);

    // 3. PROMPT ASSEMBLING
    const emotionInstruction = getEmotionInstruction(userMessage);
    const contextInstruction = getContextInjection(history as ChatMessage[]);
    const timeInstruction = getTimeBasedInstruction();
    const openerInstruction = getOpenerInstruction(history as ChatMessage[]);
    const antiSkipInstruction = getAntiSkipInstruction(history as ChatMessage[]);
    const personaInstruction = getPersonaAdaptation(history as ChatMessage[]);
    const engagementInstruction = getDeepEngagementInstruction(history as ChatMessage[]);
    const memoryInstruction = getMemoryFuzziness(history as ChatMessage[]);

    let systemPrompt = characterPrompt || BASE_SYSTEM_PROMPT;
    systemPrompt += personaInstruction;
    systemPrompt += contextInstruction;
    systemPrompt += timeInstruction;
    systemPrompt += openerInstruction;
    systemPrompt += antiSkipInstruction;
    systemPrompt += engagementInstruction;
    systemPrompt += memoryInstruction;

    if (isSpicyContext) systemPrompt += SPICY_PROMPT_ADDON;

    let finalInstruction = `[EMOTION: ${emotionInstruction}]`;
    if (preferredLanguage) finalInstruction += ` [LANGUAGE: ${preferredLanguage}]`;

    const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: userMessage },
        { role: 'system', content: finalInstruction }
    ];

    // 4. GENERATION (Robust Rotation)
    let reply = "";

    // Priority List: Target -> Backup -> Fallback List
    const modelQueue = [targetModel, MODEL_BACKUP, ...FALLBACK_MODELS];

    for (const model of modelQueue) {
        try {
            console.log(`[AI] Trying model: ${model}...`);
            reply = await fetchWithRetry(() => queryOpenRouter(model, messages));
            if (reply && reply.length > 2 && !AI_REFUSALS.test(reply)) break; // Success
        } catch (e) {
            console.warn(`[AI] Failed with ${model}. Trying next...`);
        }
    }

    if (!reply) {
        console.error("[AI] ALL MODELS FAILED. Using static fallback.");
        return [getRandomFallback()];
    }

    if (!reply || reply.length < 2 || AI_REFUSALS.test(reply)) return [getRandomFallback()];

    reply = limitEmojis(reply);
    reply = humanizeText(reply);
    reply = reply.replace(/^["']|["']$/g, '').trim();

    // 5. DOUBLE TEXT SPLIT
    if (reply.length > 40 && (reply.includes('. ') || reply.includes('? ') || reply.includes('! '))) {
        const sentences = reply.match(/[^\.!\?]+[\.!\?]+/g) || [reply];
        if (sentences.length > 1) return sentences.map(s => s.trim());
    }

    return [reply];
}

// ==========================================
// UTILS
// ==========================================

async function fetchWithRetry(fn: () => Promise<string>, retries = 1): Promise<string> {
    try {
        return await fn();
    } catch (err) {
        if (retries > 0) {
            console.log("Retrying API call...");
            await new Promise(r => setTimeout(r, 1000));
            return fetchWithRetry(fn, retries - 1);
        }
        throw err;
    }
}

function limitEmojis(text: string): string {
    return text.replace(/(.)\1{2,}/gu, '$1$1');
}

function shouldRefuseImage(history: any[]): boolean {
    const recent = history.slice(-10);
    const userRequests = recent.filter(m => m.role === 'user' && IMAGE_INTENT_REGEX.test(m.content)).length;
    const aiRefusals = recent.filter(m => m.role === 'assistant' && (
        m.content.toLowerCase().includes('no') ||
        m.content.toLowerCase().includes('cant') ||
        m.content.toLowerCase().includes('later')
    )).length;

    console.log(`[AI Refusal Logic] Requests: ${userRequests}, Refusals: ${aiRefusals}`);

    // Lower refusal rate - only 40% on first ask, 20% on second
    if (userRequests <= 1 && Math.random() < 0.4) return true;
    if (userRequests === 2 && aiRefusals >= 1 && Math.random() < 0.2) return true;
    return false;
}

async function generateImagePrompt(userText: string, persona: string): Promise<string | null> {
    const prompt = `
    IDENTITY: You are ${persona} (a real person).
    USER SAID: "${userText}"
    TASK: The user wants a photo. 
    1. If they asked for something NSFW/Flirty (nudes, body, face), output a Stable Diffusion prompt describing a realistic selfie. 
       Use tags: "raw photo, selfie, dim lighting, indian girl, 21yo, realistic skin texture, [NSFW_TAGS_IF_NEEDED]".
    2. If they asked for something generic ("send dog"), output prompt for that.
    3. If they did NOT ask for a photo, return "FALSE".
    
    OUTPUT FORMAT: Just the prompt text. OR "FALSE".
    `;

    try {
        const response = await queryOpenRouter(MODEL_SMART, [{ role: 'system', content: prompt }]);
        if (response.includes("FALSE")) return null;
        return response.replace(/["']/g, '').trim();
    } catch (e) {
        // Fallback: Generate a default prompt if AI fails
        console.log("[AI] Image prompt generation failed, using default prompt");
        return `raw photo, selfie, indian college girl, 21yo, casual, dimly lit room, realistic, beautiful`;
    }
}

async function generateStableDiffusionImage(prompt: string): Promise<string | null> {
    try {
        const negative = "deformed hands, extra fingers, cartoon, 3d render, anime, painting, bad anatomy, disfigured, watermark, text";
        const finalPrompt = encodeURIComponent(`(raw photo, realistic, 8k:1.3), ${prompt}, ${negative}`);
        const url = `https://image.pollinations.ai/prompt/${finalPrompt}?width=512&height=512&nologo=true&model=flux`;

        console.log(`[AI] Fetching image from Pollinations: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });

        if (response.data) {
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            return `data:image/jpeg;base64,${base64}`;
        }
    } catch (e) {
        console.error("Image Gen Failed:", e);
    }
    return null;
}

function humanizeText(text: string): string {
    if (Math.random() > 0.3) return text;
    let human = text.toLowerCase();
    human = human.replace(/you/g, 'u');
    human = human.replace(/are/g, 'r');
    human = human.replace(/because/g, 'coz');
    human = human.replace(/please/g, 'plz');
    human = human.replace(/message/g, 'msg');
    if (human.endsWith('.')) human = human.slice(0, -1);
    return human;
}

async function queryOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error('OPENROUTER_KEY not set');
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model, messages, temperature: 0.85, max_tokens: 150
        }, { headers: { "Authorization": `Bearer ${apiKey}`, "HTTP-Referer": "https://bakaiti.app" }, timeout: TIMEOUT_MS });
        return response.data.choices[0].message.content;
    } catch (error: any) {
        if (error.response?.data) {
            console.error(`[OpenRouter Error] ${model}:`, JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Backup function if needed later, kept for compatibility
async function queryDeepInfra(model: string, messages: ChatMessage[]): Promise<string> {
    return queryOpenRouter(model, messages);
}

function getRandomFallback(): string {
    const fallbacks = ["wait wait, kaha se h tu?", "college ya job?", "ek baat bta, single h?", "bored hoon yaar", "acha chal kuch interesting bta"];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

export function getTypingDelay(responseText: string): number {
    const isGhosting = Math.random() < 0.1;
    const extraDelay = isGhosting ? 10000 : 0;
    return Math.min(1500 + (responseText.length * 40) + extraDelay, 15000);
}
