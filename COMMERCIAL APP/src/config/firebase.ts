import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
// These values are read from environment variables at BUILD TIME
// Make sure your .env.local file has VITE_ prefix on all variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Debug: Log what we're getting (only in development)
if (import.meta.env.DEV) {
  console.log('🔧 Firebase Config Check:');
  console.log('  API Key:', firebaseConfig.apiKey?.substring(0, 20) + '...' || 'MISSING');
  console.log('  Auth Domain:', firebaseConfig.authDomain || 'MISSING');
  console.log('  Project ID:', firebaseConfig.projectId || 'MISSING');
  console.log('  Storage Bucket:', firebaseConfig.storageBucket || 'MISSING');
  console.log('  Sender ID:', firebaseConfig.messagingSenderId || 'MISSING');
  console.log('  App ID:', firebaseConfig.appId?.substring(0, 20) + '...' || 'MISSING');
}

// Validate Firebase config
const isConfigValid = () => {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const hasPlaceholders = required.some(key => {
    const value = firebaseConfig[key as keyof typeof firebaseConfig];
    return !value || value.includes('your-');
  });
  
  if (hasPlaceholders) {
    console.error('⚠️ Firebase configuration is missing! Using placeholder values.');
    console.error('Please set environment variables in .env.local with VITE_ prefix:');
    console.error('  VITE_FIREBASE_API_KEY=...');
    console.error('  VITE_FIREBASE_AUTH_DOMAIN=...');
    console.error('  VITE_FIREBASE_PROJECT_ID=...');
    console.error('  VITE_FIREBASE_STORAGE_BUCKET=...');
    console.error('  VITE_FIREBASE_MESSAGING_SENDER_ID=...');
    console.error('  VITE_FIREBASE_APP_ID=...');
    console.error('');
    console.error('Current config values:', {
      apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId?.substring(0, 10) + '...'
    });
    console.error('');
    console.error('⚠️ IMPORTANT: After updating .env.local, you MUST rebuild:');
    console.error('  npm run build');
    console.error('  npm run deploy');
    return false;
  }
  return true;
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
  if (!isConfigValid()) {
    console.warn('⚠️ Firebase initialized with placeholder config - operations will fail!');
  } else {
    console.log('✅ Firebase initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  throw error;
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

