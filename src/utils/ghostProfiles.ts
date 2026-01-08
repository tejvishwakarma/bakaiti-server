/**
 * Ghost Profile Generator
 * Creates realistic fake Indian profiles for AI matching
 */

// Pool of realistic Indian names
const MALE_NAMES = [
    'Rahul', 'Amit', 'Vikram', 'Arjun', 'Rohit', 'Karan', 'Nikhil', 'Aditya',
    'Saurabh', 'Deepak', 'Ankit', 'Varun', 'Harsh', 'Kunal', 'Pranav', 'Yash',
    'Manish', 'Raj', 'Gaurav', 'Akash', 'Sahil', 'Aman', 'Dev', 'Ravi', 'Ajay'
];

const FEMALE_NAMES = [
    'Priya', 'Sneha', 'Anjali', 'Pooja', 'Neha', 'Divya', 'Shreya', 'Kavya',
    'Riya', 'Simran', 'Aishwarya', 'Kritika', 'Sakshi', 'Tanvi', 'Meera', 'Nisha',
    'Aditi', 'Kriti', 'Ananya', 'Sanya', 'Ishita', 'Bhavna', 'Tanya', 'Mansi', 'Ruchi'
];

// Moods for matching
const MOODS = ['happy', 'chill', 'flirty', 'bored', 'random', 'curious'];

// Background colors for avatars
const AVATAR_COLORS = [
    'FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD',
    'FF7F50', '87CEEB', 'F0E68C', 'DEB887', 'E6E6FA', 'FFC0CB'
];

export interface GhostProfile {
    id: string;
    displayName: string;
    photoUrl: string;
    mood: string;
    isGhost: true;
}

/**
 * Generate a random ghost profile
 * @param preferredMood - Optional mood to match user's mood
 */
export function generateGhostProfile(preferredMood?: string): GhostProfile {
    // Random gender (50/50)
    const isMale = Math.random() > 0.5;
    const names = isMale ? MALE_NAMES : FEMALE_NAMES;
    const name = names[Math.floor(Math.random() * names.length)];

    // Generate unique ID
    const id = `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Pick avatar color
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    // Use UI Avatars for realistic looking avatars
    const photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=200&bold=true&format=png`;

    // Use preferred mood or random
    const mood = preferredMood && preferredMood !== 'random'
        ? preferredMood
        : MOODS[Math.floor(Math.random() * MOODS.length)];

    return {
        id,
        displayName: name,
        photoUrl,
        mood,
        isGhost: true
    };
}

/**
 * Get conversation starters based on mood
 */
export function getConversationStarter(mood: string): string {
    const starters: Record<string, string[]> = {
        happy: [
            "heyyy! 😄",
            "hi hi! aaj mood kaafi acha h",
            "hellooo! finally koi mila 😂",
        ],
        chill: [
            "hey",
            "hi, sup?",
            "heya",
        ],
        flirty: [
            "hey there 😏",
            "finally someone interesting 😉",
            "hii ✨",
        ],
        bored: [
            "hiiii bore ho rha tha",
            "hey yaar finally koi",
            "hi, kuch interesting btao",
        ],
        curious: [
            "hey! interesting profile",
            "hi! tu bhi yaha?",
            "heya! kya scene h",
        ],
        random: [
            "hey!",
            "hi",
            "heyyy",
        ]
    };

    const moodStarters = starters[mood] || starters.random;
    return moodStarters[Math.floor(Math.random() * moodStarters.length)];
}
