
export interface GhostProfile {
    id: string;
    displayName: string;
    photoUrl: string;
    bio: string;
    gender: 'male' | 'female';
    isGhost: true;
}

const INDIAN_MALE_NAMES = [
    "Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Reyansh", "Aryan", "Vivaan", "Krishna", "Ishaan",
    "Kabir", "Dhruv", "Rohan", "Rahul", "Vikram", "Siddharth", "Kunal", "Ravi", "Amit", "Suresh"
];

const INDIAN_FEMALE_NAMES = [
    "Diya", "Saanvi", "Ananya", "Aadhya", "Pari", "Mira", "Kiara", "Isha", "Riya", "Kavya",
    "Priya", "Neha", "Sneha", "Anjali", "Pooja", "Simran", "Nisha", "Ritu", "Meera", "Zara"
];

const CHAT_STYLES = [
    "casual", "flirty", "intellectual", "humorous", "mysterious"
];

export function generateGhostProfile(gender?: 'male' | 'female'): GhostProfile {
    const selectedGender = gender || (Math.random() > 0.5 ? 'male' : 'female');
    const nameList = selectedGender === 'male' ? INDIAN_MALE_NAMES : INDIAN_FEMALE_NAMES;
    const name = nameList[Math.floor(Math.random() * nameList.length)];

    // UI Avatars for consistent, decent seeking avatars
    const photoUrl = `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=200`;

    return {
        id: `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        displayName: name,
        photoUrl,
        bio: "Just checking this app out",
        gender: selectedGender,
        isGhost: true
    };
}
