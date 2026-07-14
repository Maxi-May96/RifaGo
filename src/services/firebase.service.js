import firebaseApp from '../config/firebase.js';
import admin from 'firebase-admin';
import path from 'path';

/**
 * Uploads an in-memory file buffer (processed by multer memoryStorage) to Firebase Cloud Storage.
 * 
 * @param {Object} file - Multer file object containing buffer
 * @param {string} folder - Destination subdirectory
 * @returns {Promise<string>} Uploaded file public URL
 */
export const uploadFile = async (file, folder = 'raffles') => {
  if (!file || !file.buffer) return '';

  if (!firebaseApp) {
    throw new Error('[Firebase Service] Firebase is not initialized. Cannot upload image.');
  }

  try {
    const bucket = admin.storage().bucket();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const destination = `${folder}/${file.fieldname}-${uniqueSuffix}${ext}`;

    const fileRef = bucket.file(destination);

    // Save the buffer directly to Firebase storage
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype
      },
      resumable: false
    });

    // Make the file publicly accessible
    await fileRef.makePublic();

    // Construct the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

    console.log(`[Firebase Service] Success: Uploaded directly to ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[Firebase Service] Upload failed:', error);
    throw error;
  }
};

/**
 * Deletes an uploaded file, handling Firebase Cloud Storage.
 * 
 * @param {string} url - Public URL of the file to delete
 */
export const deleteUploadedFile = async (url) => {
  if (!url) return;

  try {
    if (firebaseApp && url.startsWith('https://storage.googleapis.com/')) {
      const bucket = admin.storage().bucket();
      const prefix = `https://storage.googleapis.com/${bucket.name}/`;
      if (url.startsWith(prefix)) {
        const fileRelativePath = url.replace(prefix, '');
        const fileRef = bucket.file(decodeURIComponent(fileRelativePath));
        await fileRef.delete();
        console.log(`[Firebase Service] Deleted remote file: ${fileRelativePath}`);
      }
    }
  } catch (error) {
    console.error(`[Firebase Service] Error deleting file (${url}):`, error);
  }
};
