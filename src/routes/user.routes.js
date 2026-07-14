import express from 'express';
import { getProfile, updateProfile, requestWithdrawal, downloadBalancePDF } from '../controllers/user.controller.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// GET Profile page
router.get('/profile', getProfile);

// POST Update Profile with avatar and document file support
router.post('/profile', upload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'documentPhoto', maxCount: 1 }
]), updateProfile);

// POST money withdrawal request
router.post('/withdraw', requestWithdrawal);

// GET download balance pdf report
router.get('/balance/download-pdf', downloadBalancePDF);

export default router;
