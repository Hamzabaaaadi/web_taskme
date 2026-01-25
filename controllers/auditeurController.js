const mongoose = require('mongoose');
let Auditeur;
try {
  Auditeur = require('../models/Auditeur');
  Auditeur = Auditeur.Auditeur || Auditeur.default || Auditeur;
} catch (e) {
  Auditeur = null;
}

exports.list = async (req, res) => {
  try {
    if (Auditeur && typeof Auditeur.find === 'function') {
      const auditeurs = await Auditeur.find(req.query || {}).lean();
      return res.json({ auditeurs });
    }
    // fallback to raw collection
    const col = mongoose.connection.collection('auditeurs');
    const auditeurs = await col.find(req.query || {}).toArray();
    return res.json({ auditeurs });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

// Récupérer toutes les informations d'un auditeur par ID
exports.getById = async (req, res) => {
  try {
    const auditeurId = req.params.id;
    if (!auditeurId) return res.status(400).json({ message: "ID d'auditeur manquant" });

    let auditeur;
    if (Auditeur && typeof Auditeur.findById === 'function') {
      auditeur = await Auditeur.findById(auditeurId).lean();
    } else {
      const col = mongoose.connection.collection('auditeurs');
      auditeur = await col.findOne({ _id: new mongoose.Types.ObjectId(auditeurId) });
    }

    if (!auditeur) return res.status(404).json({ message: "Auditeur non trouvé" });
    return res.json({ auditeur });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', err });
  }
};