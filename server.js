require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
require("dotenv").config();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error', err));

// // Routes
// const tacheRouter = require('./controllers/tacheController');
// const userRouter = require('./controllers/userController');
// const affectationRouter = require('./controllers/affectationController');
// const chatRouter = require('./controllers/chatController');
// const vehiculeRouter = require('./controllers/vehiculeController');
// const delegationRouter = require('./controllers/delegationController');
// const notificationRouter = require('./controllers/notificationController');
// const historiqueRouter = require('./controllers/historiqueController');
// app.use('/api/taches', tacheRouter);
// app.use('/api/users', userRouter);
// app.use('/api/affectations', affectationRouter);
// app.use('/api/chats', chatRouter);
// app.use('/api/vehicules', vehiculeRouter);
// app.use('/api/delegations', delegationRouter);
// app.use('/api/notifications', notificationRouter);
// app.use('/api/historiques', historiqueRouter);

// app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// User routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
module.exports = app;   