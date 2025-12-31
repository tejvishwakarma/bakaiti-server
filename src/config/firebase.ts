import * as admin from 'firebase-admin';
import config from './index';

let firebaseApp: admin.app.App | null = null;

export function initializeFirebase(): admin.app.App {
    if (!firebaseApp) {
        // Convert escaped newlines to real newlines (common issue with .env files)
        const privateKey = config.firebase.privateKey?.replace(/\\n/g, '\n');

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: config.firebase.projectId,
                clientEmail: config.firebase.clientEmail,
                privateKey: privateKey,
            }),
        });
        console.log('✅ Firebase Admin initialized');
    }
    return firebaseApp;
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('❌ Firebase token verification failed:', error);
        return null;
    }
}

export default initializeFirebase;
