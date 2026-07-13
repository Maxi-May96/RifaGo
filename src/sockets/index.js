/**
 * Socket.IO Singleton
 * Allows controllers to emit events without circular imports.
 * Initialize with setIO(io) in server.js, then use emitToRaffle() anywhere.
 */

let _io = null;

export const setIO = (io) => {
  _io = io;
};

export const getIO = () => _io;

/**
 * Emit an event to all clients watching a specific raffle room.
 * @param {string} raffleId - MongoDB ObjectId as string
 * @param {string} event - Socket event name
 * @param {object} data - Payload
 */
export const emitToRaffle = (raffleId, event, data) => {
  if (_io) {
    _io.to(`raffle:${raffleId}`).emit(event, data);
  }
};
