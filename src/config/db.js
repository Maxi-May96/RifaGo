import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Coupon from '../models/Coupon.js';

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Seed default coupons if collection is empty
    const count = await Coupon.countDocuments();
    if (count === 0) {
      await Coupon.create([
        { code: 'RIFAGO50', discountType: 'percentage', discountValue: 50 },
        { code: 'RIFAGO100', discountType: 'percentage', discountValue: 100 },
        { code: 'BIENVENIDA20', discountType: 'percentage', discountValue: 20 },
        { code: 'DESCUENTO10', discountType: 'percentage', discountValue: 10 },
        { code: 'FREE1500', discountType: 'fixed', discountValue: 1500 }
      ]);
      console.log('Default coupons seeded successfully.');
    }
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

export default connectDB;
