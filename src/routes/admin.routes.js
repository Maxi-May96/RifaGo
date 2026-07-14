import express from 'express';
import { 
  getDashboard, 
  getUsers, 
  verifyUser, 
  unverifyUser, 
  getCoupons, 
  createCoupon, 
  deleteCoupon,
  getRaffles,
  updateRaffleStatus
} from '../controllers/admin.controller.js';

const router = express.Router();

// GET Admin Dashboard analytics
router.get('/dashboard', getDashboard);

// GET Users Management list
router.get('/users', getUsers);

// POST Verify User identification document
router.post('/users/:id/verify', verifyUser);

// POST Unverify User identification document
router.post('/users/:id/unverify', unverifyUser);

// GET Coupons Management list & form
router.get('/coupons', getCoupons);

// POST Create Coupon
router.post('/coupons', createCoupon);

// POST Delete Coupon
router.post('/coupons/:id/delete', deleteCoupon);

// GET Raffles Management list
router.get('/raffles', getRaffles);

// POST Update Raffle status
router.post('/raffles/:id/status', updateRaffleStatus);

export default router;
