const mongoose = require('mongoose');

// GET /api/assignments/active/:auditorId
// Returns active assignments for a single auditor (auditorId)
exports.getActiveAssignments = async (req, res) => {
  try {
    const auditorId = req.params.auditorId;
    if (!auditorId) return res.status(400).json({ message: 'auditorId requis' });

    // Load models
    let Affectation = null;
    try {
      const possible = require('../models/Affectation');
      Affectation = possible && (possible.Affectation || possible.default || possible);
    } catch (e) {
      Affectation = require('../models/Affectation');
    }

    // Fetch affectations for this auditor and populate tache dates
    const items = await Affectation.find({ auditeurId: auditorId }).populate('tacheId', 'dateDebut dateFin').lean();

    const now = new Date();

    // Determine active: either status indicates active OR task date window includes today
    const active = items.filter(a => {
      if (!a.tacheId) return false;
      const t = a.tacheId;
      const start = t.dateDebut ? new Date(t.dateDebut) : null;
      const end = t.dateFin ? new Date(t.dateFin) : null;
      const statusActive = (a.statut === 'ACCEPTEE' || a.statut === 'EN_COURS');
      const inWindow = start && end ? (now >= start && now <= end) : false;
      return statusActive || inWindow;
    }).map(a => ({
      taskId: a.tacheId && a.tacheId._id ? a.tacheId._id.toString() : (a.tacheId && a.tacheId.id) || null,
      dateDebut: a.tacheId && a.tacheId.dateDebut ? new Date(a.tacheId.dateDebut).toISOString().slice(0,10) : null,
      dateFin: a.tacheId && a.tacheId.dateFin ? new Date(a.tacheId.dateFin).toISOString().slice(0,10) : null
    }));

    return res.json({ auditorId: auditorId, affectations: active });
  } catch (err) {
    console.error('getActiveAssignments error:', err);
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
