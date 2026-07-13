import mongoose from 'mongoose';

/**
 * Represents a single ticket number within a raffle.
 * Used for atomic reservation and sale tracking.
 * The unique compound index prevents race conditions.
 */
const NumberSchema = new mongoose.Schema({
  raffle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Raffle',
    required: true
  },
  number: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['reserved', 'pending_payment', 'sold'],
    default: 'reserved'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    default: null
  },
  // TTL for reservations — auto-released after this time
  reservedUntil: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Unique index: prevents two users from claiming the same number
NumberSchema.index({ raffle: 1, number: 1 }, { unique: true });

// Index for TTL cleanup queries
NumberSchema.index({ status: 1, reservedUntil: 1 });

const NumberModel = mongoose.model('Number', NumberSchema);
export default NumberModel;
