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