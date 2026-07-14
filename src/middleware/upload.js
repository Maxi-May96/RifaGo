import multer from 'multer';
import path from 'path';

// Setup Memory Storage
const storage = multer.memoryStorage();

// File extensions and MIME validator
const fileFilter = (req, file, cb) => {
  // If file input was submitted empty, skip it gracefully
  if (!file.originalname || file.originalname.trim() === '') {
    return cb(null, false);
  }

  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (.jpg, .jpeg, .png)'));
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum
  fileFilter: fileFilter
});
