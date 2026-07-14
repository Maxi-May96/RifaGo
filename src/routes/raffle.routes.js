import express from 'express';
import { 
  getMyRaffles, 
  getCreateRaffle, 
  postCreateRaffle, 
  duplicateRaffle, 
  deleteRaffle, 
  exportBuyers,
  validateCoupon,
  getRaffleDetail,
  getRafflesList,
  drawRaffle,
  confirmRaffleCreation,
  failRaffleCreation,
  reportRaffle
} from '../controllers/raffle.controller.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
const router = express.Router();

// Protected routes
router.get('/myraffles', protect, getMyRaffles);
router.get('/creation-success', protect, confirmRaffleCreation);
router.get('/creation-failure', protect, failRaffleCreation);
router.get('/create', protect, getCreateRaffle);
router.post('/create', protect, upload.any(), postCreateRaffle);
router.post('/:id/duplicate', protect, duplicateRaffle);
router.post('/:id/delete', protect, deleteRaffle);
router.post('/:id/draw', protect, drawRaffle);
router.post('/:id/report', protect, reportRaffle);
router.get('/:id/export', protect, exportBuyers);

// Public routes (Catch-all slug must be at the bottom)
router.get('/', getRafflesList);
router.get('/validate-coupon', validateCoupon);
router.get('/:slug', getRaffleDetail);

export default router;
