const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

  try {
    let userDoc = null;
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findOne === 'function') {
        userDoc = await Model.findOne({ email }).lean();
      }
    } catch (e) {
      // ignore, fallback to raw collection
    }

    if (!userDoc) {
      const col = mongoose.connection.collection('user');
      userDoc = await col.findOne({ email });
    }

    if (!userDoc) return res.status(400).json({ message: 'Identifiants invalides' });

    const hashed = userDoc.motDePasse || userDoc.password || '';
    const match = await bcrypt.compare(password, hashed);
    if (!match) return res.status(400).json({ message: 'Identifiants invalides' });

    // Refuse login if account is not active
    if (userDoc.estActif === false) return res.status(403).json({ message: "Compte désactivé" });

    if (userDoc.motDePasse) delete userDoc.motDePasse;
    if (userDoc.password) delete userDoc.password;

    return res.json({ message: 'Connexion réussie', user: userDoc });
  } catch (err) {
    console.error('Auth login error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function register(req, res) {
  const {
    nom,
    prenom,
    email,
    password,
    role,
    specialite,
    grade,
    nombre_des_taches,
    diplomes,
    formations,
    anciennete
  } = req.body || {};

  try {
    // check existing user
    let Model = null;
    try {
      const possible = require('../models/User');
      Model = possible && (possible.User || possible.default || possible);
    } catch (e) {
      Model = null;
    }

    if (Model && typeof Model.findOne === 'function') {
      const exists = await Model.findOne({ email });
      if (exists) return res.status(400).json({ message: "L'email est déjà utilisé" });
    } else {
      const col = mongoose.connection.collection('user');
      const exists = await col.findOne({ email });
      if (exists) return res.status(400).json({ message: "L'email est déjà utilisé" });
    }

    const hashed = await bcrypt.hash(password, 10);

    let createdUser = null;
    if (Model && typeof Model.create === 'function') {
      createdUser = await Model.create({ nom, prenom, email, motDePasse: hashed, role });
      createdUser = createdUser.toObject ? createdUser.toObject() : createdUser;
    } else {
      const col = mongoose.connection.collection('user');
      const insert = await col.insertOne({ nom, prenom, email, motDePasse: hashed, role, dateCreation: new Date(), estActif: false });
      createdUser = await col.findOne({ _id: insert.insertedId });
    }

    // if auditeur, create auditeur entry
    let auditeurDoc = null;
    if (role === 'AUDITEUR') {
      try {
        const possibleA = require('../models/Auditeur');
        const AudModel = possibleA && (possibleA.Auditeur || possibleA.default || possibleA);
        if (AudModel && typeof AudModel.create === 'function') {
          auditeurDoc = await AudModel.create({ userId: createdUser._id, specialite, grade, nombre_des_taches, diplomes, formations, anciennete });
          auditeurDoc = auditeurDoc.toObject ? auditeurDoc.toObject() : auditeurDoc;
        } else {
          const colA = mongoose.connection.collection('auditeurs');
          const insertA = await colA.insertOne({ userId: createdUser._id, specialite, grade, nombre_des_taches, diplomes, formations, anciennete });
          auditeurDoc = await colA.findOne({ _id: insertA.insertedId });
        }
      } catch (e) {
        console.error('Error creating auditeur:', e);
      }
    }

    // remove password
    if (createdUser.motDePasse) delete createdUser.motDePasse;
    if (createdUser.password) delete createdUser.password;

    return res.status(201).json({ message: 'Utilisateur créé', user: createdUser, auditeur: auditeurDoc });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { login, register };

async function logout(req, res) {
  try {
    const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!authHeader) return res.status(200).json({ message: 'Déconnecté' });

    const parts = authHeader.split(' ');
    const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
    if (!token) return res.status(200).json({ message: 'Déconnecté' });

    const col = mongoose.connection.collection('blacklisted_tokens');
    await col.insertOne({ token, createdAt: new Date() });

    return res.status(200).json({ message: 'Déconnecté' });
  } catch (e) {
    console.error('Logout error:', e);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

// export including logout
module.exports = { login, register, logout };
