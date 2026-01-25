let ioInstance = null;

export function init(io) {
  ioInstance = io;
}

export function get() {
  if (!ioInstance) throw new Error('Socket.IO not initialized');
  return ioInstance;
}

export default { init, get };
