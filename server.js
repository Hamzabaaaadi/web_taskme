
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
// Ensure Mongoose models are registered (User model required for populate to work)
require('./models/User');
const cors = require('cors');
const app = express();
require("dotenv").config();
const socketLib = require('./lib/socket');

const searchRoutes = require('./routes/searchRoutes');
const vehiculeRoutes = require('./routes/vehiculeRoutes');
const semiautoRoutes = require('./routes/semiautoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error', err));

// ...autres routes déjà présentes...
app.use('/api/search', searchRoutes);
app.use('/api/vehicles', vehiculeRoutes);
app.use('/api/semiauto', semiautoRoutes);

// // Routes
const tacheRoutes = require('./routes/tacheRoutes');
app.use('/api/tasks', tacheRoutes);

// Assignment routes
const assignmentRoutes = require('./routes/assignmentRoutes');
app.use('/api/assignments', assignmentRoutes);

const auditeurRoutes = require('./routes/auditeurRoutes');
app.use('/api/auditeurs', auditeurRoutes);

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// User routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Affectation routes
const affectationRoutes = require('./routes/affectationRoutes');
app.use('/api/affectations', affectationRoutes);

// Delegation routes
const delegationRoutes = require('./routes/delegationRoutes');
app.use('/api/delegations', delegationRoutes);
// ...existing code...
const chatsRouter = require('./routes/chatRoutes')
app.use('/chats', chatsRouter)
// ...existing code...

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Create HTTP server and attach socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST','PUT'] } });

// simple socket auth middleware: expects handshake.auth.token to be userId or a JWT
const jwtConfig = require('./config/jwt');
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const payload = jwtConfig.verifyToken(token);
      socket.userId = payload && (payload.id || payload._id || payload.userId);
      if (!socket.userId) return next(new Error('Invalid token payload'));
      next();
    } catch (e) {
      return next(new Error('Authentication error'));
    }
  } catch (err) { next(err); }
});

io.on('connection', (socket) => {
  if (socket.userId) socket.join(`user_${socket.userId}`);
  console.log('socket connected', socket.id, 'userId=', socket.userId);
  socket.on('disconnect', () => console.log('socket disconnected', socket.id));
});

// initialize socket singleton
socketLib.init(io);

server.listen(PORT, () => console.log(`Server running on ${PORT}`));
module.exports = app;