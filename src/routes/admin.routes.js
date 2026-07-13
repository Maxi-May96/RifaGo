import express from 'express';
import { getDashboard, getUsers, verifyUser, unverifyUser } from '../controllers/admin.controller.js';

const router = express.Router();

// GET Admin Dashboard analytics
router.get('/dashboard', getDashboard);

// GET Users Management list
router.get('/users', getUsers);

// POST Verify User identification document
router.post('/users/:id/verify', verifyUser);

// POST Unverify User identification document
router.post('/users/:id/unverify', unverifyUser);

export default router;
