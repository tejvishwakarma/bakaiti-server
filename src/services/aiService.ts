import axios from 'axios';
import { GhostProfile } from '../utils/ghostProfiles';

// Configuration
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt/';
// const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'; // For future use

interface AIMessageResponse {
    text?: string;
    imageUrl?: string;
    isImage: boolean;
}

export class AIService {

    /**
     * Determines if the user text implies a request for an image
     */
    static isImageRequest(text: string): boolean {
        const thirstyRegex = /(send|show|give).*(pic|photo|image|nude|boobs|ass|tits|selfie|face|body)/i;
        return thirstyRegex.test(text);
    }

    /**
     * Generates an image using Pollinations.ai (Free, Fast, No Auth)
     */
    static async generateImage(prompt: string): Promise<string> {
        // Enhance prompt for "realism" without getting banned
        const enhancedPrompt = `realistic photo, ${prompt}, high quality, 4k`;
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        // Pollinations URL returns the image directly
        // We will fetch it and convert to base64 to match our socket protocol
        // OR we can just return the URL if the frontend supports it.
        // The plan said "Socket Image Handling (Base64)", so let's try to fetch and convert.

        try {
            const imageUrl = `${POLLINATIONS_IMAGE_URL}${encodedPrompt}`;
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            return `data:image/jpeg;base64,${base64}`;
        } catch (error) {
            console.error('Error generating image via Pollinations:', error);
            throw new Error('Failed to generate image');
        }
    }

    /**
     * Generates a text response acting as the ghost persona
     */
    static async generateTextResponse(
        userText: string,
        ghostProfile: GhostProfile,
        chatHistory: { role: 'user' | 'assistant', content: string }[]
    ): Promise<string> {
        // TODO: Implement OpenRouter/DeepInfra integration here
        // For now, simple rule-based responses to prove the flow works

        const lowerText = userText.toLowerCase();

        if (lowerText.includes('hi') || lowerText.includes('hello')) {
            return `Hey! I'm ${ghostProfile.displayName}. What's up?`;
        }

        if (lowerText.includes('asl') || lowerText.includes('age')) {
            return "21, from Mumbai. You?";
        }

        if (lowerText.includes('bot') || lowerText.includes('ai')) {
            return "Lol what? Do I look like a bot to you? 😂";
        }

        // Default generic responses
        const generics = [
            "Haha true",
            "Tell me more about that",
            "That's interesting",
            "I'm bored tbh",
            "Send a pic?"
        ];

        return generics[Math.floor(Math.random() * generics.length)];
    }
}
