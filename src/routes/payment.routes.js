import express from 'express';
import { handleWebhook } from '../controllers/payment.controller.js';

const router = express.Router();

// Webhook endpoint does NOT require protect middleware since it is called by Mercado Pago servers
router.post('/webhook', handleWebhook);

export default router;
