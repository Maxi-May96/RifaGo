import mongoose from 'mongoose';

/**
 * Tracks payments made TO RifaGo (raffle creation fees).
 * Separate from Purchase which tracks ticket sales between buyers and raffles.
 */
const PaymentSchema = new mongoose.Schema({
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['creation'],
    default: 'creation'
  },
  // Mercado Pago references
  mpPreferenceId: {
    type: String,
    default: null
  },
  mpPaymentId: {
    type: String,
    default: null
  },
  mpStatus: {
    type: String,
    default: null
  }
}, { timestamps: true });

const Payment = mongoose.model('Payment', PaymentSchema);
export default Payment;
