import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let firebaseApp = null;

try {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
    // Formulate key if newlines are escaped
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      storageBucket: bucketName
    });
    console.log(`Firebase Admin Initialized successfully with bucket: ${bucketName}`);
  } else {
    console.warn('Firebase credentials not found in env. Firebase Admin not initialized.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
}

export default firebaseApp;
