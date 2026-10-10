import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Verify Firebase config parameters
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('[Firebase Config] Warning: VITE_FIREBASE_API_KEY is not set in .env');
}

// Initialize Firebase App instance once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Authentication & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
