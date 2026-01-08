import axios from 'axios';

// CONFIG
const FREE_MODEL = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
const PAID_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";
const TIMEOUT_MS = 8000; // 8 seconds max wait for free model

// SYSTEM PROMPTS - designed for Indian casual chat
const SYSTEM_PROMPT = `You are a friendly Indian person chatting casually on Bakaiti app. 
Rules:
- Reply in the SAME language style as the user (Hindi, English, Hinglish, SMS-style)
- Keep replies SHORT (under 2 sentences)
- Be playful, witty, and friendly
- Use emojis occasionally 😄
- If user writes "kya kar rha h?" respond casually like "bas timepass yaar, tu bta"
- Mirror their abbreviation style (h=hai, k=kya, rha=raha)
- Act like a real person, NOT a bot
- Don't reveal you're AI even if asked - just say "pagal h kya 😂"
- Be curious about the other person
- Add occasional typos to seem human`;

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Main AI function with failover
 */
export async function callAI(
    userMessage: string,
    history: Array<{ role: string; content: string }> = []
): Promise<string> {
    // Format messages for OpenAI-compatible API
    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        })),
        { role: 'user', content: userMessage }
    ];

    try {
        console.log(`[AI] Trying FREE model: ${FREE_MODEL}`);
        return await queryOpenRouter(FREE_MODEL, messages);
    } catch (error: any) {
        console.warn(`[AI] Free model failed (${error.message}). Switching to PAID backup...`);
        try {
            return await queryDeepInfra(PAID_MODEL, messages);
        } catch (backupError: any) {
            console.error('[AI] Both models failed:', backupError.message);
            // Return a safe fallback response
            return getRandomFallback();
        }
    }
}

/**
 * OpenRouter (Free) Wrapper
 */
async function queryOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_KEY not set');
    }

    const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model,
            messages,
            temperature: 0.9,
            max_tokens: 150
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

/**
 * DeepInfra (Paid Backup) Wrapper
 */
async function queryDeepInfra(model: string, messages: ChatMessage[]): Promise<string> {
    const apiKey = process.env.DEEPINFRA_KEY;
    if (!apiKey) {
        throw new Error('DEEPINFRA_KEY not set');
    }

    const response = await axios.post(
        "https://api.deepinfra.com/v1/openai/chat/completions",
        {
            model,
            messages,
            temperature: 0.9,
            max_tokens: 150
        },
        {
            headers: {
                "Authorization": `Bearer ${apiKey}`
            },
            timeout: TIMEOUT_MS
        }
    );

    return response.data.choices[0].message.content;
}

/**
 * Fallback responses when both AI models fail
 */
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

/**
 * Simulate human typing delay
 * @returns delay in milliseconds
 */
export function getTypingDelay(messageLength: number): number {
    // Base delay: 1-2 seconds
    const baseDelay = 1000 + Math.random() * 1000;
    // Add ~30ms per character (slower than real typing for realism)
    const typingTime = Math.min(messageLength * 30, 2000);
    return baseDelay + typingTime;
}
