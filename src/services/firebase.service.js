import firebaseApp from '../config/firebase.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Uploads a local file (processed by multer) to Firebase Cloud Storage.
 * Cleans up the local copy on successful upload.
 * Falls back to returning the local public relative URL if Firebase is not active.
 * 
 * @param {Object} file - Multer file object
 * @param {string} folder - Destination subdirectory
 * @returns {Promise<string>} Uploaded file URL or local fallback path
 */
export const uploadFile = async (file, folder = 'raffles') => {
  if (!file) return '';

  // Fallback to local if Firebase is not configured
  if (!firebaseApp) {
    console.warn(`[Firebase Service] Fallback: Using local storage path for ${file.filename}`);
    return `/uploads/${folder}/${file.filename}`;
  }

  try {
    const bucket = admin.storage().bucket();
    const destination = `${folder}/${Date.now()}-${file.filename}`;

    // Upload local file to Firebase bucket
    const [uploadedFile] = await bucket.upload(file.path, {
      destination,
      metadata: {
        contentType: file.mimetype
      }
    });

    // Make the file publicly accessible
    await uploadedFile.makePublic();

    // Construct the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uploadedFile.name}`;

    // Delete local temporary file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    console.log(`[Firebase Service] Success: Uploaded to ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[Firebase Service] Upload failed, returning local fallback path:', error);
    // Return local fallback path (file remains on disk)
    return `/uploads/${folder}/${file.filename}`;
  }
};

/**
 * Deletes an uploaded file, handling both local storage and Firebase Cloud Storage.
 * 
 * @param {string} url - Public URL or relative path of the file to delete
 */
export const deleteUploadedFile = async (url) => {
  if (!url) return;

  try {
    // 1. Firebase deletion
    if (firebaseApp && url.startsWith('https://storage.googleapis.com/')) {
      const bucket = admin.storage().bucket();
      const prefix = `https://storage.googleapis.com/${bucket.name}/`;
      if (url.startsWith(prefix)) {
        const fileRelativePath = url.replace(prefix, '');
        const fileRef = bucket.file(decodeURIComponent(fileRelativePath));
        await fileRef.delete();
        console.log(`[Firebase Service] Deleted remote file: ${fileRelativePath}`);
        return;
      }
    }

    // 2. Local deletion fallback
    if (url.startsWith('/uploads/')) {
      // Relative path: /uploads/raffles/filename.ext
      const localFilePath = path.join(__dirname, '../public', url);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`[Firebase Service] Deleted local file: ${localFilePath}`);
      }
    }
  } catch (error) {
    console.error(`[Firebase Service] Error deleting file (${url}):`, error);
  }
};
