async function me(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    // Try Mongoose model first (to include full fields like motDePasse)
    try {
      const possible = require('../models/User');
      const Model = possible && (possible.User || possible.default || possible);
      if (Model && typeof Model.findById === 'function') {
        const user = await Model.findById(current._id).lean();
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

        // If the user is an auditeur, attach auditeur-specific record
        if (user.role === 'AUDITEUR') {
          try {
            const audPossible = require('../models/Auditeur');
            const Aud = audPossible && (audPossible.Auditeur || audPossible.default || audPossible);
            if (Aud && typeof Aud.findOne === 'function') {
              const aud = await Aud.findOne({ userId: user._id }).lean();
              if (aud) user.auditeur = aud;
            }
          } catch (e) {
            // ignore auditeur lookup errors
          }
        }

        // Return full user (including hashed password/motDePasse)
        return res.json({ user });
      }
    } catch (e) {
      // ignore and fallback to raw collection
    }

    // Fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('user');
    const { ObjectId } = mongooseLib.Types;
    let queryId = current._id;
    try { queryId = new ObjectId(current._id); } catch (e) { /* keep original id */ }
    const userDoc = await col.findOne({ _id: queryId });
    if (!userDoc) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    if (userDoc.role === 'AUDITEUR') {
      try {
        const audCol = mongooseLib.connection.collection('auditeurs');
        const aud = await audCol.findOne({ userId: queryId });
        if (aud) userDoc.auditeur = aud;
      } catch (e) {
        // ignore
      }
    }

    return res.json({ user: userDoc });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function update(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    const { nom, prenom, email, password } = req.body || {};
    // auditeur-specific fields
    const { specialite, grade, nombre_des_taches, diplomes, formations, anciennete } = req.body || {};

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
          // If auditeur fields present or user role is AUDITEUR, upsert auditeur record
          try {
            const audPossible = require('../models/Auditeur');
            const Aud = audPossible && (audPossible.Auditeur || audPossible.default || audPossible);
            const audFields = {};
            if (specialite !== undefined) audFields.specialite = specialite;
            if (grade !== undefined) audFields.grade = grade;
            if (nombre_des_taches !== undefined) audFields.nombre_des_taches = nombre_des_taches;
            if (diplomes !== undefined) audFields.diplomes = diplomes;
            if (formations !== undefined) audFields.formations = formations;
            if (anciennete !== undefined) audFields.anciennete = anciennete;

            if (Object.keys(audFields).length > 0 || updated.role === 'AUDITEUR') {
              if (Aud && typeof Aud.findOneAndUpdate === 'function') {
                await Aud.findOneAndUpdate({ userId: updated._id }, { $set: audFields, $setOnInsert: { userId: updated._id } }, { upsert: true, new: true });
              } else {
                const mongooseLib = require('mongoose');
                const audCol = mongooseLib.connection.collection('auditeurs');
                const query = { userId: updated._id };
                const updateOp = { $set: audFields, $setOnInsert: { userId: updated._id } };
                await audCol.updateOne(query, updateOp, { upsert: true });
              }
              // attach auditeur record if exists
              try {
                const audPossible2 = require('../models/Auditeur');
                const Aud2 = audPossible2 && (audPossible2.Auditeur || audPossible2.default || audPossible2);
                if (Aud2 && typeof Aud2.findOne === 'function') {
                  const audRec = await Aud2.findOne({ userId: updated._id }).lean();
                  if (audRec) updated.auditeur = audRec;
                }
              } catch (e) { /* ignore */ }
            }

            return res.json({ message: 'Profil mis à jour', user: updated });
          } catch (e) {
            // if auditeur handling fails, still return updated user
            return res.json({ message: 'Profil mis à jour', user: updated });
          }
        }
      }
    } catch (e) {
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection update
    const col = mongoose.connection.collection('user');
    await col.updateOne({ _id: current._id }, { $set: updateFields });
    const updatedDoc = await col.findOne({ _id: current._id });

    // handle auditeur upsert in raw collection mode
    try {
      const audCol = mongoose.connection.collection('auditeurs');
      const audFields = {};
      if (specialite !== undefined) audFields.specialite = specialite;
      if (grade !== undefined) audFields.grade = grade;
      if (nombre_des_taches !== undefined) audFields.nombre_des_taches = nombre_des_taches;
      if (diplomes !== undefined) audFields.diplomes = diplomes;
      if (formations !== undefined) audFields.formations = formations;
      if (anciennete !== undefined) audFields.anciennete = anciennete;

      if (Object.keys(audFields).length > 0 || updatedDoc.role === 'AUDITEUR') {
        await audCol.updateOne({ userId: updatedDoc._id }, { $set: audFields, $setOnInsert: { userId: updatedDoc._id } }, { upsert: true });
        const audRec = await audCol.findOne({ userId: updatedDoc._id });
        if (audRec) updatedDoc.auditeur = audRec;
      }
    } catch (e) {
      // ignore auditeur errors
    }

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

async function list(req, res) {
  try {
    const query = req.query.query || '';
    const possible = require('../models/User');
    const User = possible && (possible.User || possible.default || possible);
    const users = await User.find({
      $or: [
        { nom: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listAuditeurs(req, res) {
  try {
    const possible = require('../models/User');
    const User = possible && (possible.User || possible.default || possible);
    const auditeurs = await User.find({ role: 'AUDITEUR' });
    res.json({ auditeurs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function listAll(req, res) {
  try {
    const possible = require('../models/User');
    const User = possible && (possible.User || possible.default || possible);
    const users = await User.find({}).lean();
    users.forEach(u => {
      if (u.motDePasse) delete u.motDePasse;
      if (u.password) delete u.password;
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { me, update, getById, updateUser, deleteUser, list, listAuditeurs, listAll };