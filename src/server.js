import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connectDB from './config/db.js';
import { PORT } from './config/env.js';
import { setIO } from './sockets/index.js';
import { initRaffleSocket } from './sockets/raffle.socket.js';

// Create HTTP server wrapping Express
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling']
});

// Register socket singleton so controllers can emit events
setIO(io);

// Register socket handlers
initRaffleSocket(io);

// Connect to MongoDB, then start listening
connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` RifaGo Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Socket.IO: enabled`);
    console.log(`=========================================`);
  });
}).catch((error) => {
  console.error('Failed to initialize server due to Database connection error:', error.message);
  process.exit(1);
});
