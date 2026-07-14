import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es obligatorio']
  },
  amount: {
    type: Number,
    required: [true, 'El monto a retirar es obligatorio'],
    min: [100, 'El monto mínimo a retirar es de $100 ARS']
  },
  destination: {
    bankName: {
      type: String,
      required: [true, 'El nombre del banco o billetera es obligatorio']
    },
    cbu: {
      type: String,
      required: [true, 'El CBU/CVU es obligatorio']
    },
    alias: {
      type: String,
      required: [true, 'El alias es obligatorio']
    },
    holderName: {
      type: String,
      required: [true, 'El nombre del titular es obligatorio']
    }
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected'],
    default: 'pending'
  },
  processedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

export default Withdrawal;
