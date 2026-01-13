
import axios from 'axios';
import { AIService } from './src/services/aiService';

async function test() {
    console.log('\nTesting Image Generation...');

    // Test 1: Original URL
    try {
        console.log('Trying https://pollinations.ai/p/...');
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent('cat')}`;
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const content = Buffer.from(response.data).toString('utf8');

        // Check for common HTML tags indicating an error page
        if (content.trim().startsWith('<') || content.includes('<!DOCTYPE html>')) {
            console.log('❌ GOT HTML INSTEAD OF IMAGE:', content.substring(0, 100));
        } else {
            console.log('✅ Got Binary Data. Length:', response.data.length);
        }
    } catch (e: any) {
        console.log('Error 1:', e.message);
    }

    // Test 2: Alternative URL
    try {
        console.log('\nTrying https://image.pollinations.ai/prompt/...');
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent('cat')}`;
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const content = Buffer.from(response.data).toString('utf8');

        if (content.trim().startsWith('<') || content.includes('<!DOCTYPE html>')) {
            console.log('❌ GOT HTML INSTEAD OF IMAGE:', content.substring(0, 100));
        } else {
            console.log('✅ Got Binary Data! Length:', response.data.length);
        }
    } catch (e: any) {
        console.log('Error 2:', e.message);
    }
}

test();
