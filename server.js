
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();
require("dotenv").config();

const searchRoutes = require('./routes/searchRoutes');
const vehiculeRoutes = require('./routes/vehiculeRoutes');
const semiautoRoutes = require('./routes/semiautoRoutes');

const PORT = process.env.PORT || 5000;

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

// app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
module.exports = app;