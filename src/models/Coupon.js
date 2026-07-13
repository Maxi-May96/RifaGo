import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'El código de descuento es obligatorio'],
    unique: true,
    uppercase: true,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: [true, 'El valor del descuento es obligatorio'],
    min: [0, 'El valor no puede ser negativo']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save validation: if percentage, value must be <= 100
CouponSchema.pre('save', function(next) {
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    return next(new Error('El porcentaje de descuento no puede superar el 100%'));
  }
  next();
});

const Coupon = mongoose.model('Coupon', CouponSchema);
export default Coupon;
