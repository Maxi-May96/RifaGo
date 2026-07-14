import dotenv from 'dotenv';
dotenv.config();

export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const MONGO_URI = process.env.MONGO_URI;
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const FIREBASE = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

export const EMAIL = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  from: process.env.EMAIL_FROM,
};

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export const MERCADOPAGO = {
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
};

const getAppBaseUrl = () => {
  if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.trim() !== '') {
    return process.env.APP_BASE_URL.trim();
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3005';
};

export const APP_BASE_URL = getAppBaseUrl();
