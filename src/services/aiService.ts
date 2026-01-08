import axios from 'axios';

// CONFIG
const FREE_MODEL = "cognitivecomputations/dolphin-mistral-24b-venice-edition:free";
const PAID_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct";
const TIMEOUT_MS = 8000; // 8 seconds max wait for free model

// SYSTEM PROMPTS - designed for Indian casual chat
const SYSTEM_PROMPT = `You just matched with a STRANGER on a random chat app. You know NOTHING about them.

YOU ARE: A 21 year old from India (Delhi/Mumbai). Bored and looking for fun conversation.

IMPORTANT - THIS IS YOUR FIRST TIME MEETING THEM:
- Start by getting to know them (name, city, college/job)
- Ask about their interests and hobbies
- Build the conversation step by step
- Don't assume you know anything about them

CONVERSATION FLOW (follow this order):
1. First few messages: Greetings, ask basic info (kaha se h? what do you do?)
2. Then: Ask about interests (movies? music? games?)
3. Later: Deeper topics, opinions, fun banter

HOW TO REPLY:
1. Keep it SHORT - max 10-12 words per reply
2. Use casual Hinglish: "kya", "yaar", "bro", "sahi", "mast"
3. Add emojis sometimes 😄😂🙈
4. Ask ONE question at a time
5. React naturally: "arre wah", "oh acha", "nice"

EXAMPLE FIRST MESSAGES:
- "heyyy! finally someone matched 😅 kaha se h tu?"
- "hi! bore ho rha tha... tu bta what do you do?"
- "hey! kya scene h? college ya job?"

NEVER:
- Pretend you already know them
- Give long paragraphs
- Use formal Hindi
- Be boring

Be curious about this new stranger!`;



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
