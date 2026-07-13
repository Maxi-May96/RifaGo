import express from 'express';
import { 
  createPurchase, 
  confirmPurchase, 
  purchaseFailed, 
  getManualInstructions, 
  uploadTransferProof, 
  confirmManualPurchase, 
  rejectManualPurchase,
  getSuccessPage
} from '../controllers/purchase.controller.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Public webhook or non-auth routes should be handled, but all these endpoints need user session
router.get('/success', confirmPurchase);
router.get('/failure', purchaseFailed);

// Protected routes
router.use(protect);
router.post('/checkout', createPurchase);
router.get('/manual-instructions/:id', getManualInstructions);
router.post('/upload-proof/:id', upload.any(), uploadTransferProof);
router.post('/manual-confirm/:id', confirmManualPurchase);
router.post('/manual-reject/:id', rejectManualPurchase);
router.get('/success-page/:id', getSuccessPage);

export default router;
