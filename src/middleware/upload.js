import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target root upload directory in public folder
const uploadsDir = path.join(__dirname, '../public/uploads');

// Setup Disk Storage with dynamic folder allocation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let targetFolder = uploadsDir;
    if (file.fieldname === 'profilePhoto') {
      targetFolder = path.join(uploadsDir, 'avatars');
    } else if (file.fieldname === 'documentPhoto') {
      targetFolder = path.join(uploadsDir, 'documents');
    } else {
      targetFolder = path.join(uploadsDir, 'raffles');
    }
    
    // Ensure destination directory is created
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

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
