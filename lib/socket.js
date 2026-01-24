let ioInstance = null;

function init(io) {
  ioInstance = io;
}

function get() {
  if (!ioInstance) throw new Error('Socket.IO not initialized');
  return ioInstance;
}

module.exports = { init, get };
