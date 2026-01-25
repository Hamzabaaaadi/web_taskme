const mongoose = require('mongoose');

// GET /api/rotation-order
// Returns an ordered list of auditeur IDs by rotation rules.
exports.getRotationOrder = async (req, res) => {
  try {
    // Try loading Auditeur model (may be exported as ESM)
    let AuditeurModel = null;
    try {
      const possible = require('../models/Auditeur');
      AuditeurModel = possible && (possible.Auditeur || possible.default || possible);
    } catch (e) {
      AuditeurModel = null;
    }

    // Fetch auditeurs
    let auditeurs = [];
    if (AuditeurModel && typeof AuditeurModel.find === 'function') {
      auditeurs = await AuditeurModel.find({}).lean();
    } else {
      const col = mongoose.connection.collection('auditeurs');
      auditeurs = await col.find({}).toArray();
    }

    const AffCol = mongoose.connection.collection('affectations');

    // Attach lastAffectation timestamp for sorting
    const withMeta = await Promise.all(auditeurs.map(async (a) => {
      const audId = a._id || a.id || null;
      let last = null;
      try {
        const lastAff = await AffCol.find({ auditeurId: audId }).sort({ dateAffectation: -1 }).limit(1).toArray();
        if (lastAff && lastAff.length) last = lastAff[0].dateAffectation || lastAff[0].dateReponse || null;
      } catch (e) {
        // ignore
      }
      return Object.assign({}, a, { lastAffectation: last || null });
    }));

    // Sort rules:
    // 1) anciennete descending (higher anciennete first)
    // 2) lastAffectation ascending (older/never assigned first)
    // 3) nombre_des_taches ascending (less loaded first)
    withMeta.sort((x, y) => {
      const ax = (x.anciennete || 0);
      const ay = (y.anciennete || 0);
      if (ay !== ax) return ay - ax; // desc

      const lx = x.lastAffectation ? new Date(x.lastAffectation).getTime() : 0;
      const ly = y.lastAffectation ? new Date(y.lastAffectation).getTime() : 0;
      if (lx !== ly) return lx - ly; // older first

      const nx = x.nombre_des_taches || 0;
      const ny = y.nombre_des_taches || 0;
      return nx - ny;
    });

    const ordre = withMeta.map(a => (a._id || a.id).toString());
    return res.json({ ordre });
  } catch (err) {
    console.error('rotationController.getRotationOrder error:', err);
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
