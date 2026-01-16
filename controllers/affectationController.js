const mongoose = require('mongoose');

async function getMyAffectations(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    // Vérifier que l'utilisateur a le rôle AUDITEUR
    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé. Seuls les auditeurs peuvent accéder à leurs affectations.' });
    }

    const auditeurId = current._id;

    // Try Mongoose model first
    try {
      const Affectation = require('../models/Affectation');
      const Model = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
      
      if (Model && typeof Model.find === 'function') {
        // Convertir l'ID en ObjectId si nécessaire
        const { ObjectId } = mongoose.Types;
        let queryId = auditeurId;
        try { 
          queryId = new ObjectId(auditeurId); 
        } catch (e) { 
          // garder l'ID tel quel si conversion échoue
        }

        const affectations = await Model.find({ auditeurId: queryId })
          .populate('tacheId', 'nom description statut')
          .populate('auditeurId', 'nom prenom email')
          .sort({ dateAffectation: -1 })
          .lean();
        // Ensure `mode` is present for each affectation (default to MANUELLE)
        const normalized = (affectations || []).map(a => {
          if (!a.mode) a.mode = 'MANUELLE';
          return a;
        });

        return res.json({ 
          message: 'Affectations récupérées avec succès',
          count: normalized.length,
          affectations: normalized
        });
      }
    } catch (e) {
      console.error('Mongoose model error:', e);
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection
    const col = mongoose.connection.collection('affectations');
    const { ObjectId } = mongoose.Types;
    let queryId = auditeurId;
    try { 
      queryId = new ObjectId(auditeurId); 
    } catch (e) { 
      // garder l'ID tel quel si conversion échoue
    }

    const affectations = await col.find({ auditeurId: queryId }).toArray();
    const normalized = (affectations || []).map(a => {
      if (!a.mode) a.mode = 'MANUELLE';
      return a;
    });
    return res.json({ 
      message: 'Affectations récupérées avec succès',
      count: normalized.length,
      affectations: normalized
    });
  } catch (err) {
    console.error('Get my affectations error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function list(req, res) {
  try {
    // Try Mongoose model first and populate some related fields for convenience
    try {
      const Affectation = require('../models/Affectation');
      const Model = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
      if (Model && typeof Model.find === 'function') {
        const query = req.query || {};
        const affectations = await Model.find(query)
          .populate('tacheId', 'nom statut')
          .populate('auditeurId', 'nom prenom email')
          .lean();
        // ensure `mode` is present (schema default should handle new docs)
        const normalized = (affectations || []).map(a => {
          if (!a.mode) a.mode = 'MANUELLE';
          return a;
        });
        return res.json({ affectations: normalized });
      }
    } catch (e) {
      console.error('affectationController.list model error:', e && e.message ? e.message : e);
    }

    // Fallback to raw collection with explicit projection to include `mode`
    const col = mongoose.connection.collection('affectations');
    const projection = { projection: { mode: 1, tacheId: 1, auditeurId: 1, statut: 1, dateAffectation: 1, dateReponse:1 } };
    const affectations = await col.find(req.query || {}, projection).toArray();
    const normalized = (affectations || []).map(a => {
      if (!a.mode) a.mode = 'MANUELLE';
      return a;
    });
    return res.json({ affectations: normalized });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
}

async function acceptAffectation(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') return res.status(403).json({ message: 'Accès refusé' });

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    try {
      const Affectation = require('../models/Affectation');
      const Model = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
      if (Model && typeof Model.findByIdAndUpdate === 'function') {
        const mongooseLib = require('mongoose');
        const { ObjectId } = mongooseLib.Types;
        let queryId = id;
        try { queryId = new ObjectId(id); } catch (e) { }

        const existing = await Model.findById(queryId).lean();
        if (!existing) return res.status(404).json({ message: 'Affectation non trouvée' });
        if (existing.auditeurId && existing.auditeurId.toString() !== current._id.toString()) {
          return res.status(403).json({ message: 'Vous n\'êtes pas l\'auditeur assigné' });
        }

        const updated = await Model.findByIdAndUpdate(queryId, { $set: { statut: 'ACCEPTEE', dateReponse: new Date(), estValidee: true } }, { new: true }).lean();
        return res.json({ message: 'Affectation acceptée', affectation: updated });
      }
    } catch (e) {
      // ignore and fallback
    }

    // fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('affectations');
    const { ObjectId } = mongooseLib.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { }

    const aff = await col.findOne({ _id: queryId });
    if (!aff) return res.status(404).json({ message: 'Affectation non trouvée' });
    if (aff.auditeurId && aff.auditeurId.toString() !== current._id.toString()) {
      return res.status(403).json({ message: 'Vous n\'êtes pas l\'auditeur assigné' });
    }

    await col.updateOne({ _id: queryId }, { $set: { statut: 'ACCEPTEE', dateReponse: new Date(), estValidee: true } });
    const updatedDoc = await col.findOne({ _id: queryId });
    return res.json({ message: 'Affectation acceptée', affectation: updatedDoc });
  } catch (err) {
    console.error('acceptAffectation error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function refuseAffectation(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') return res.status(403).json({ message: 'Accès refusé' });

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });
    const { justificatifRefus } = req.body || {};

    try {
      const Affectation = require('../models/Affectation');
      const Model = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
      if (Model && typeof Model.findByIdAndUpdate === 'function') {
        const mongooseLib = require('mongoose');
        const { ObjectId } = mongooseLib.Types;
        let queryId = id;
        try { queryId = new ObjectId(id); } catch (e) { }

        const existing = await Model.findById(queryId).lean();
        if (!existing) return res.status(404).json({ message: 'Affectation non trouvée' });
        if (existing.auditeurId && existing.auditeurId.toString() !== current._id.toString()) {
          return res.status(403).json({ message: 'Vous n\'êtes pas l\'auditeur assigné' });
        }

        const updated = await Model.findByIdAndUpdate(queryId, { $set: { statut: 'REFUSEE', justificatifRefus: justificatifRefus || null, dateReponse: new Date(), estValidee: false } }, { new: true }).lean();
        return res.json({ message: 'Affectation refusée', affectation: updated });
      }
    } catch (e) {
      // ignore and fallback
    }

    // fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('affectations');
    const { ObjectId } = mongooseLib.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { }

    const aff = await col.findOne({ _id: queryId });
    if (!aff) return res.status(404).json({ message: 'Affectation non trouvée' });
    if (aff.auditeurId && aff.auditeurId.toString() !== current._id.toString()) {
      return res.status(403).json({ message: 'Vous n\'êtes pas l\'auditeur assigné' });
    }

    await col.updateOne({ _id: queryId }, { $set: { statut: 'REFUSEE', justificatifRefus: justificatifRefus || null, dateReponse: new Date(), estValidee: false } });
    const updatedDoc = await col.findOne({ _id: queryId });
    return res.json({ message: 'Affectation refusée', affectation: updatedDoc });
  } catch (err) {
    console.error('refuseAffectation error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

// exports will be declared at the end (after deleteAffectation is defined)
async function deleteAffectation(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    // Try using Mongoose model first
    try {
      const Affectation = require('../models/Affectation');
      const Model = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
      if (Model && typeof Model.findByIdAndDelete === 'function') {
        const mongooseLib = require('mongoose');
        const { ObjectId } = mongooseLib.Types;
        let queryId = id;
        try { queryId = new ObjectId(id); } catch (e) { }

        const existing = await Model.findById(queryId).lean();
        if (!existing) return res.status(404).json({ message: 'Affectation non trouvée' });

        await Model.findByIdAndDelete(queryId);
        return res.json({ message: 'Affectation supprimée' });
      }
    } catch (e) {
      console.error('deleteAffectation model error:', e && e.message ? e.message : e);
    }

    // Fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('affectations');
    const { ObjectId } = mongooseLib.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { }

    const aff = await col.findOne({ _id: queryId });
    if (!aff) return res.status(404).json({ message: 'Affectation non trouvée' });

    await col.deleteOne({ _id: queryId });
    return res.json({ message: 'Affectation supprimée' });
  } catch (err) {
    console.error('deleteAffectation error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { getMyAffectations, list, acceptAffectation, refuseAffectation, deleteAffectation };
