/**
 * Raffle Socket Handler
 * Manages real-time room-based events for the ticket grid.
 */
export const initRaffleSocket = (io) => {
  io.on('connection', (socket) => {
    // Client joins the room for a specific raffle to receive live updates
    socket.on('raffle:join', (raffleId) => {
      if (raffleId) {
        socket.join(`raffle:${raffleId}`);
      }
    });

    // Client leaves the raffle room
    socket.on('raffle:leave', (raffleId) => {
      if (raffleId) {
        socket.leave(`raffle:${raffleId}`);
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically removes from all rooms on disconnect
    });
  });
};
