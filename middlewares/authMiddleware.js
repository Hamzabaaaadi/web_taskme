const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Basic Auth middleware — checks Authorization: Basic <base64(email:password)>
async function basicAuth(req, res, next) {
  try {
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!auth) return res.status(401).json({ message: 'Authorization required' });

    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') return res.status(401).json({ message: 'Invalid authorization format' });

    const creds = Buffer.from(parts[1], 'base64').toString('utf8');
    const idx = creds.indexOf(':');
    if (idx === -1) return res.status(401).json({ message: 'Invalid basic auth credentials' });

    const email = creds.substring(0, idx);
    const password = creds.substring(idx + 1);
    if (!email || !password) return res.status(401).json({ message: 'Email and password required' });

    // Try to use the Mongoose model if available
    let userDoc = null;
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findOne === 'function') {
        userDoc = await Model.findOne({ email }).lean();
      }
    } catch (e) {
      // ignore
    }

    if (!userDoc) {
      const col = mongoose.connection.collection('user');
      userDoc = await col.findOne({ email });
    }

    if (!userDoc) return res.status(401).json({ message: 'Invalid credentials' });

    const hashed = userDoc.motDePasse || userDoc.password || '';
    const ok = await bcrypt.compare(password, hashed);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    // Block access if account is inactive
    if (userDoc.estActif === false) return res.status(403).json({ message: 'Compte désactivé' });

    if (userDoc.motDePasse) delete userDoc.motDePasse;
    if (userDoc.password) delete userDoc.password;

    req.user = userDoc;
    next();
  } catch (err) {
    console.error('basicAuth error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { basicAuth };
