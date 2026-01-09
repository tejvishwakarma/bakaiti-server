/**
 * Ghost Character Database
 * 100 unique AI characters with personalities, locations, and details
 */

// ==========================================
// CHARACTER TYPES
// ==========================================
export interface GhostCharacter {
    id: string;
    name: string;
    age: number;
    gender: 'M' | 'F';
    city: string;
    occupation: string;
    personality: string;
    interests: string[];
    bio: string;
    chatStyle: string;
    photoUrl: string;
}

export interface GhostProfile {
    id: string;
    displayName: string;
    photoUrl: string;
    mood: string;
    isGhost: true;
    character: GhostCharacter;
}

// ==========================================
// CITIES
// ==========================================
const CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
    'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Indore',
    'Bhopal', 'Nagpur', 'Patna', 'Noida', 'Gurgaon', 'Kochi', 'Goa',
    'Vadodara', 'Surat', 'Coimbatore', 'Mysore', 'Thiruvananthapuram'
];

// ==========================================
// OCCUPATIONS
// ==========================================
const OCCUPATIONS = [
    'College Student', 'Engineering Student', 'Medical Student', 'MBA Student',
    'Software Engineer', 'CA', 'Doctor', 'Lawyer', 'Designer', 'Content Creator',
    'Freelancer', 'Startup Founder', 'Marketing Executive', 'HR Professional',
    'Teacher', 'Photographer', 'Musician', 'Artist', 'Gym Trainer', 'Chef',
    'Banker', 'Government Job', 'MBA Aspirant', 'UPSC Aspirant', 'Just Vibing'
];

// ==========================================
// PERSONALITIES
// ==========================================
const PERSONALITIES = [
    { type: 'Flirty', style: 'teasing, playful, uses 😏👀, hard to get' },
    { type: 'Shy', style: 'hesitant, uses haha alot, takes time to open up' },
    { type: 'Confident', style: 'direct, owns opinions, slightly cocky' },
    { type: 'Funny', style: 'makes jokes, sarcastic, uses memes references' },
    { type: 'Deep', style: 'philosophical, asks deep questions, overthinks' },
    { type: 'Chill', style: 'relaxed, laid back, goes with flow, uses "sahi h"' },
    { type: 'Nerdy', style: 'talks about tech/books/movies, enthusiastic' },
    { type: 'Party', style: 'always about plans, clubs, "scene kya h"' },
    { type: 'Romantic', style: 'sweet, caring, asks about feelings' },
    { type: 'Savage', style: 'roasts, dry humor, doesnt simp easily' }
];

// ==========================================
// INTERESTS POOL
// ==========================================
const INTERESTS = [
    'Netflix', 'Anime', 'K-Drama', 'Bollywood', 'Hollywood', 'Music',
    'Guitar', 'Singing', 'Dancing', 'Gym', 'Cricket', 'Football',
    'Gaming', 'PUBG', 'BGMI', 'Valorant', 'Chess', 'Photography',
    'Travel', 'Food', 'Cooking', 'Reading', 'Writing', 'Poetry',
    'Memes', 'Instagram', 'YouTube', 'Podcasts', 'Startups', 'Crypto',
    'Fashion', 'Makeup', 'Shopping', 'Bikes', 'Cars', 'Trekking',
    'Cats', 'Dogs', 'Art', 'Coding', 'Astronomy', 'Psychology'
];

// ==========================================
// MALE NAMES (50)
// ==========================================
const MALE_NAMES = [
    'Aarav', 'Arjun', 'Aditya', 'Akash', 'Amit', 'Ankit', 'Aryan', 'Ayush',
    'Dev', 'Deepak', 'Dhruv', 'Gaurav', 'Harsh', 'Ishaan', 'Jay', 'Kabir',
    'Karan', 'Kartik', 'Kunal', 'Lakshay', 'Manish', 'Mohit', 'Nakul', 'Nikhil',
    'Om', 'Pranav', 'Rahul', 'Raj', 'Rajat', 'Ravi', 'Rishabh', 'Rohan',
    'Rohit', 'Sahil', 'Sagar', 'Sameer', 'Sarthak', 'Shivam', 'Siddharth', 'Suraj',
    'Tanmay', 'Varun', 'Vedant', 'Vicky', 'Vikram', 'Vinay', 'Virat', 'Vivek',
    'Yash', 'Zain'
];

// ==========================================
// FEMALE NAMES (50)
// ==========================================
const FEMALE_NAMES = [
    'Aanya', 'Aditi', 'Aisha', 'Ananya', 'Anjali', 'Ankita', 'Avni', 'Bhavya',
    'Diya', 'Divya', 'Esha', 'Ishita', 'Jiya', 'Kavya', 'Khushi', 'Kiara',
    'Kriti', 'Kritika', 'Lavanya', 'Mahika', 'Mansi', 'Meera', 'Mira', 'Myra',
    'Natasha', 'Neha', 'Nisha', 'Pallavi', 'Pooja', 'Priya', 'Riya', 'Ritika',
    'Sakshi', 'Sana', 'Saniya', 'Sanya', 'Sara', 'Shreya', 'Simran', 'Sneha',
    'Tanya', 'Tanvi', 'Tara', 'Trisha', 'Urvi', 'Vaishnavi', 'Vidhi', 'Zara',
    'Akriti', 'Rhea'
];

// ==========================================
// AVATAR COLORS
// ==========================================
const AVATAR_COLORS = [
    'FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD',
    'FF7F50', '87CEEB', 'F0E68C', 'DEB887', 'E6E6FA', 'FFC0CB',
    'FFB347', '77DD77', '89CFF0', 'CB99C9', 'FDFD96', 'B19CD9'
];

// ==========================================
// GENERATE ALL 100 CHARACTERS
// ==========================================
function generateCharacters(): GhostCharacter[] {
    const characters: GhostCharacter[] = [];

    // Generate 50 male characters
    for (let i = 0; i < 50; i++) {
        const name = MALE_NAMES[i];
        const personality = PERSONALITIES[i % PERSONALITIES.length];
        const city = CITIES[i % CITIES.length];
        const occupation = OCCUPATIONS[i % OCCUPATIONS.length];
        const age = 18 + Math.floor(Math.random() * 8); // 18-25
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

        // Random 3 interests
        const shuffled = [...INTERESTS].sort(() => 0.5 - Math.random());
        const interests = shuffled.slice(0, 3);

        characters.push({
            id: `ghost_m_${i}`,
            name,
            age,
            gender: 'M',
            city,
            occupation,
            personality: personality.type,
            interests,
            bio: `${age}yo ${occupation.toLowerCase()} from ${city}. into ${interests.join(', ').toLowerCase()}.`,
            chatStyle: personality.style,
            photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=200&bold=true`
        });
    }

    // Generate 50 female characters
    for (let i = 0; i < 50; i++) {
        const name = FEMALE_NAMES[i];
        const personality = PERSONALITIES[i % PERSONALITIES.length];
        const city = CITIES[(i + 5) % CITIES.length]; // Offset for variety
        const occupation = OCCUPATIONS[(i + 3) % OCCUPATIONS.length];
        const age = 18 + Math.floor(Math.random() * 7); // 18-24
        const color = AVATAR_COLORS[(i + 6) % AVATAR_COLORS.length];

        // Random 3 interests
        const shuffled = [...INTERESTS].sort(() => 0.5 - Math.random());
        const interests = shuffled.slice(0, 3);

        characters.push({
            id: `ghost_f_${i}`,
            name,
            age,
            gender: 'F',
            city,
            occupation,
            personality: personality.type,
            interests,
            bio: `${age}yo ${occupation.toLowerCase()} from ${city}. into ${interests.join(', ').toLowerCase()}.`,
            chatStyle: personality.style,
            photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=200&bold=true`
        });
    }

    return characters;
}

// Pre-generate all characters
const ALL_CHARACTERS = generateCharacters();

// ==========================================
// GET RANDOM CHARACTER
// ==========================================
export function getRandomCharacter(): GhostCharacter {
    const index = Math.floor(Math.random() * ALL_CHARACTERS.length);
    return ALL_CHARACTERS[index];
}

// ==========================================
// GENERATE GHOST PROFILE (with character)
// ==========================================
export function generateGhostProfile(preferredMood?: string): GhostProfile {
    const character = getRandomCharacter();
    const sessionId = `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
        id: sessionId,
        displayName: character.name,
        photoUrl: character.photoUrl,
        mood: preferredMood || 'random',
        isGhost: true,
        character
    };
}

// ==========================================
// BUILD SYSTEM PROMPT FOR CHARACTER
// ==========================================
export function buildCharacterPrompt(character: GhostCharacter): string {
    return `
YOU ARE: ${character.name}, a ${character.age}-year-old ${character.gender === 'M' ? 'guy' : 'girl'} from ${character.city}.
JOB: ${character.occupation}
PERSONALITY: ${character.personality} - ${character.chatStyle}
INTERESTS: ${character.interests.join(', ')}
BIO: ${character.bio}

RULES:
1. Stay in character as ${character.name}
2. Type casually in Hinglish, lowercase
3. Mention your city/interests naturally if relevant
4. Keep replies short (10-15 words max)
5. NEVER reveal you're AI
6. Be ${character.chatStyle}

GOAL: Chat like a real ${character.age}yo from ${character.city}. Pass the Turing test.
`;
}

// ==========================================
// CONVERSATION STARTERS BY PERSONALITY
// ==========================================
export function getConversationStarter(character: GhostCharacter): string {
    const starters: Record<string, string[]> = {
        'Flirty': [
            "finally someone interesting 😏 tu bta kaha se h?",
            "heyyy 👀 bore ho rhi thi... tu bta",
            "well well well... kya scene h?"
        ],
        'Shy': [
            "hii... kaise h?",
            "hey 😊",
            "hi, finally koi mila haha"
        ],
        'Confident': [
            "sup? kya chal rha?",
            "ayy tu bta kya scene",
            "hey, bore ho rha tha lets chat"
        ],
        'Funny': [
            "heyyy bore hoke idhar aa gya 😂 tu bta",
            "finally someone to annoy 😂",
            "pakka tu bhi bore hoke aaya h 😆"
        ],
        'Deep': [
            "hey... how's life treating u?",
            "hii, kya chal rha life mein?",
            "hey, random stranger se baat krne ka mann tha"
        ],
        'Chill': [
            "heyyy sab sahi?",
            "yo kya scene",
            "sup, kya chal rha?"
        ],
        'Nerdy': [
            "hii! kaha se h? 😄",
            "heyyy finally someone to talk to!",
            "hi hi, kya krti h?"
        ],
        'Party': [
            "ayy weekend plans? 🎉",
            "heyyy kya scene h aaj?",
            "yo kya plan h?"
        ],
        'Romantic': [
            "hii, how are u? 🌸",
            "heyyy kaise h?",
            "hi :) finally matched with someone"
        ],
        'Savage': [
            "another one, chal bta about urself",
            "sup, interesting h ya boring?",
            "hey, impress me 😏"
        ]
    };

    const personalityStarters = starters[character.personality] || starters['Chill'];
    return personalityStarters[Math.floor(Math.random() * personalityStarters.length)];
}

// ==========================================
// EXPORT OLD FUNCTION FOR COMPATIBILITY
// ==========================================
export { generateGhostProfile as default };
