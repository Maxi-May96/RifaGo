import mongoose from 'mongoose';

const PurchaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es obligatorio']
  },
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: [true, 'El sorteo es obligatorio']
  },
  numbers: {
    type: [Number],
    required: [true, 'Debe seleccionar al menos un número']
  },
  amount: {
    type: Number,
    required: [true, 'El monto es obligatorio']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    default: ''
  },
  // Payment mode determines how the buyer paid
  paymentMode: {
    type: String,
    enum: ['rifago', 'manual'],
    default: 'rifago'
  },
  // For manual mode: image URL of transfer proof uploaded by buyer
  transferProof: {
    type: String,
    default: null
  },
  // Creator who confirmed the manual purchase
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const Purchase = mongoose.model('Purchase', PurchaseSchema);

export default Purchase;
