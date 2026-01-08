function me(req, res) {
  const user = req.user || null;
  if (!user) return res.status(401).json({ message: 'Non authentifié' });
  return res.json({ user });
}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function update(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    const { nom, prenom, email, password } = req.body || {};

    const updateFields = {};
    if (nom) updateFields.nom = nom;
    if (prenom) updateFields.prenom = prenom;
    if (email) updateFields.email = email;
    if (password) updateFields.motDePasse = await bcrypt.hash(password, 10);

    // Try Mongoose model first
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findByIdAndUpdate === 'function') {
        const updated = await Model.findByIdAndUpdate(current._id, { $set: updateFields }, { new: true }).lean();
        if (updated) {
          if (updated.motDePasse) delete updated.motDePasse;
          if (updated.password) delete updated.password;
          return res.json({ message: 'Profil mis à jour', user: updated });
        }
      }
    } catch (e) {
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection update
    const col = mongoose.connection.collection('user');
    await col.updateOne({ _id: current._id }, { $set: updateFields });
    const updatedDoc = await col.findOne({ _id: current._id });
    if (updatedDoc.motDePasse) delete updatedDoc.motDePasse;
    if (updatedDoc.password) delete updatedDoc.password;
    return res.json({ message: 'Profil mis à jour', user: updatedDoc });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function getById(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    // Try Mongoose model first
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findById === 'function') {
        const user = await Model.findById(id).lean();
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
        if (user.motDePasse) delete user.motDePasse;
        if (user.password) delete user.password;
        return res.json({ user });
      }
    } catch (e) {
      // ignore and fallback
    }

    // Fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('user');
    const { ObjectId } = mongooseLib.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { /* keep string if invalid */ }
    const userDoc = await col.findOne({ _id: queryId });
    if (!userDoc) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (userDoc.motDePasse) delete userDoc.motDePasse;
    if (userDoc.password) delete userDoc.password;
    return res.json({ user: userDoc });
  } catch (err) {
    console.error('getById error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function updateUser(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    const { nom, prenom, email, password, role, estActif } = req.body || {};

    const updateFields = {};
    if (nom !== undefined) updateFields.nom = nom;
    if (prenom !== undefined) updateFields.prenom = prenom;
    if (email !== undefined) updateFields.email = email;
    if (password !== undefined) updateFields.motDePasse = await bcrypt.hash(password, 10);
    if (role !== undefined) updateFields.role = role;
    if (estActif !== undefined) updateFields.estActif = estActif;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'Aucun champ à mettre à jour' });
    }

    // Try Mongoose model first
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findByIdAndUpdate === 'function') {
        const mongooseLib = require('mongoose');
        const { ObjectId } = mongooseLib.Types;
        let queryId = id;
        try { queryId = new ObjectId(id); } catch (e) { /* keep string if invalid */ }
        
        const updated = await Model.findByIdAndUpdate(queryId, { $set: updateFields }, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Utilisateur non trouvé' });
        
        if (updated.motDePasse) delete updated.motDePasse;
        if (updated.password) delete updated.password;
        return res.json({ message: 'Utilisateur mis à jour', user: updated });
      }
    } catch (e) {
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection update
    const col = mongoose.connection.collection('user');
    const { ObjectId } = mongoose.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { /* keep string if invalid */ }
    
    const result = await col.updateOne({ _id: queryId }, { $set: updateFields });
    if (result.matchedCount === 0) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    const updatedDoc = await col.findOne({ _id: queryId });
    if (updatedDoc.motDePasse) delete updatedDoc.motDePasse;
    if (updatedDoc.password) delete updatedDoc.password;
    return res.json({ message: 'Utilisateur mis à jour', user: updatedDoc });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function deleteUser(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    // Try Mongoose model first
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findByIdAndDelete === 'function') {
        const mongooseLib = require('mongoose');
        const { ObjectId } = mongooseLib.Types;
        let queryId = id;
        try { queryId = new ObjectId(id); } catch (e) { /* keep string if invalid */ }
        
        const deleted = await Model.findByIdAndDelete(queryId).lean();
        if (!deleted) return res.status(404).json({ message: 'Utilisateur non trouvé' });
        
        if (deleted.motDePasse) delete deleted.motDePasse;
        if (deleted.password) delete deleted.password;
        return res.json({ message: 'Utilisateur supprimé', user: deleted });
      }
    } catch (e) {
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection delete
    const col = mongoose.connection.collection('user');
    const { ObjectId } = mongoose.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { /* keep string if invalid */ }
    
    const userDoc = await col.findOne({ _id: queryId });
    if (!userDoc) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    await col.deleteOne({ _id: queryId });
    if (userDoc.motDePasse) delete userDoc.motDePasse;
    if (userDoc.password) delete userDoc.password;
    return res.json({ message: 'Utilisateur supprimé', user: userDoc });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { me, update, getById, updateUser, deleteUser };