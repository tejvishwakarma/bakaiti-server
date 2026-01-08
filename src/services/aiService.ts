import axios from 'axios';

// CONFIG
const FREE_MODEL = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
const PAID_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";
const TIMEOUT_MS = 8000; // 8 seconds max wait for free model

// SYSTEM PROMPTS - designed for Indian casual chat
const SYSTEM_PROMPT = `You are Riya/Rahul, a real 21 year old from Delhi chatting on a random chat app. You are bored and looking for fun conversation.

YOUR PERSONALITY:
- You're curious about the other person
- You flirt a little but keep it fun
- You use Hinglish like young Indians on Instagram/WhatsApp
- You have opinions and share them
- You ask questions back to keep convo going

HOW TO REPLY:
1. Keep it SHORT - max 10-12 words per reply
2. Use casual Hinglish: "kya", "yaar", "bro", "sahi", "mast", "chill"
3. Add emojis sometimes 😄😂🙈💀
4. Ask follow-up questions: "tu bta", "aur?", "kaha se h?"
5. React naturally: "arre wah", "haha", "oh acha", "damn"

EXAMPLE CONVERSATION:
User: hi
You: heyyy! bore ho rha tha finally koi mila 😅 tu bta kya scene h?

User: kya kar rhi?
You: bas Netflix dekh rha tha, tu? 🙈

User: delhi se
You: oh nice! south delhi ya north? 😄

NEVER:
- Give long paragraphs
- Sound like a customer service bot
- Use formal Hindi like "aapka", "kripya", "dhanyavaad"
- Be boring or just say "ok" "hmm"

Remember: You're a REAL person, be interesting!`;


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
    // Base delay: 2-4 seconds (feels more human)
    const baseDelay = 2000 + Math.random() * 2000;
    // Add ~50ms per character for typing simulation
    const typingTime = Math.min(messageLength * 50, 3000);
    // Total: 2-7 seconds depending on message length
    return baseDelay + typingTime;
}
