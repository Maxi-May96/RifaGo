import app from '../src/app.js';
import connectDB from '../src/config/db.js';

let isConnected = false;

const startServerless = async (req, res) => {
  if (!isConnected) {
    try {
      // Connect to MongoDB if not connected
      await connectDB();
      isConnected = true;
    } catch (error) {
      console.error('Serverless connection to database error:', error);
      return res.status(500).send('Database connection failed');
    }
  }
  return app(req, res);
};

export default startServerless;
