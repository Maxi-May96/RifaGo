import firebaseApp from '../config/firebase.js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

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
