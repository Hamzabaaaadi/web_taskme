
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
// Ensure Mongoose models are registered (User model required for populate to work)
import './models/User.js';
import cors from 'cors';
const app = express();

import socketLib from './lib/socket.js';

import searchRoutes from './routes/searchRoutes.js';
import vehiculeRoutes from './routes/vehiculeRoutes.js';
import semiautoRoutes from './routes/semiautoRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

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
import tacheRoutes from './routes/tacheRoutes.js';
app.use('/api/tasks', tacheRoutes);

// Assignment routes
import assignmentRoutes from './routes/assignmentRoutes.js';
app.use('/api/assignments', assignmentRoutes);

import auditeurRoutes from './routes/auditeurRoutes.js';
app.use('/api/auditeurs', auditeurRoutes);

// Auth routes
import authRoutes from './routes/authRoutes.js';
app.use('/api/auth', authRoutes);

// User routes
import userRoutes from './routes/userRoutes.js';
app.use('/api/users', userRoutes);

// Affectation routes
import affectationRoutes from './routes/affectationRoutes.js';
app.use('/api/affectations', affectationRoutes);

// Delegation routes
import delegationRoutes from './routes/delegationRoutes.js';
app.use('/api/delegations', delegationRoutes);
// ...existing code...
import chatsRouter from './routes/chatRoutes.js';
app.use('/chats', chatsRouter);
// ...existing code...

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Create HTTP server and attach socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST','PUT'] } });

// simple socket auth middleware: expects handshake.auth.token to be userId or a JWT
import jwtConfig from './config/jwt.js';
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
export default app;