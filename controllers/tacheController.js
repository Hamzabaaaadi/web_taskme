exports.assign = async (req, res) => {
  // Affecter un ou plusieurs auditeurs à une tâche
  try {
    const { auditeurId, mode } = req.body;
    const tacheId = req.params.id;
    if (!auditeurId) {
      return res.status(400).json({ error: "auditeurId requis" });
    }

    // Vérifier que la tâche existe
    const Tache = require('../models/Tache');
    const tache = await Tache.findById(tacheId);
    if (!tache) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    // Validate mode if provided, otherwise default will be applied by the schema
    const allowedModes = ['MANUELLE','SEMIAUTO','AUTOMATIQUE_IA'];
    let chosenMode = mode;
    if (typeof chosenMode === 'undefined' || chosenMode === null) {
      chosenMode = 'MANUELLE';
    } else if (!allowedModes.includes(chosenMode)) {
      return res.status(400).json({ error: `mode invalide. Valeurs autorisées: ${allowedModes.join(', ')}` });
    }

    // Créer l'affectation réelle
    const Affectation = require('../models/Affectation');
    const affectation = new Affectation({
      tacheId,
      auditeurId,
      mode: chosenMode,
      dateAffectation: new Date()
    });
    await affectation.save();

    return res.status(201).json({
      message: "Affectation créée avec succès",
      affectationId: affectation._id,
      tacheId,
      auditeurId
    });
  } catch (error) {
    console.error("Erreur assignation:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.validateAssign = async (req, res) => {
  // Valider une affectation
    try {
      const affectationId = req.body.affectationId || req.params.affectationId;
      const { commentaire } = req.body;
      const Affectation = require('../models/Affectation');
      // Chercher l'affectation par son ID
      const affectation = await Affectation.findById(affectationId);
      if (!affectation) {
        return res.status(404).json({ error: "Affectation non trouvée" });
      }
      // Mettre à jour uniquement le champ estValidee
      affectation.estValidee = true;
      if (commentaire) affectation.justificatifRefus = commentaire;
      affectation.dateReponse = new Date();
      await affectation.save();

      return res.status(200).json({
        message: "Affectation validée (estValidee = true)",
        affectationId: affectation._id,
        tacheId: affectation.tacheId,
        commentaire
      });
    } catch (error) {
      console.error("Erreur validation affectation:", error);
      return res.status(500).json({ error: error.message });
    }
};

exports.rejectAssign = async (req, res) => {
  try {
    const affectationId = req.body.affectationId || req.params.affectationId;
    const { commentaire } = req.body;
    const Affectation = require('../models/Affectation');
    // Chercher l'affectation par son ID
    const affectation = await Affectation.findById(affectationId);
    if (!affectation) {
      return res.status(404).json({ error: "Affectation non trouvée" });
    }

    // Mettre à jour le statut et le commentaire
    affectation.statut = "REFUSEE";
    // s'assurer que le flag de validation est explicitement false lorsqu'on refuse
    affectation.estValidee = false;
    if (commentaire) affectation.justificatifRefus = commentaire;
    affectation.dateReponse = new Date();
    await affectation.save();
    return res.status(200).json({
      message: "Affectation refusée (estValidee = false)",
      affectationId: affectation._id,
      tacheId: affectation.tacheId,
      commentaire
    });
  } catch (error) {
    console.error("Erreur rejet affectation:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.delegateAssign = async (req, res) => {
  // Déléguer une affectation
  res.json({ message: 'Affectation déléguée (mock)', tacheId: req.params.id });
};
const Tache = require('../models/Tache');
const path = require('path');

exports.list = async (req, res) => {
  try {
    const filter = req.query || {};
    const taches = await Tache.find(filter).lean();
    res.json({ taches });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.detail = async (req, res) => {
  try {
    const tache = await Tache.findById(req.params.id).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });
    res.json({ tache });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.create = async (req, res) => {
  try {
    const tache = await Tache.create(req.body);
    res.status(201).json({ tache });
  } catch (err) {
    console.error('Erreur création tâche:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message, stack: err.stack });
  }
};

exports.update = async (req, res) => {
  try {
    const tache = await Tache.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });
    res.json({ tache });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.delete = async (req, res) => {
  try {
    const tache = await Tache.findByIdAndDelete(req.params.id).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });
    res.json({ message: 'Tâche supprimée', tache });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Fichier requis' });
    const tache = await Tache.findByIdAndUpdate(req.params.id, { fichierAdministratif: req.file.filename }, { new: true }).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });
    res.json({ message: 'Fichier uploadé', tache });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

// Marquer une tâche comme terminée (statut = TERMINEE)
exports.complete = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    const tache = await Tache.findByIdAndUpdate(id, { statut: 'TERMINEE' }, { new: true }).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });

    return res.json({ message: 'Tâche marquée comme terminée', tache });
  } catch (err) {
    console.error('Erreur marquer tâche terminée:', err);
    return res.status(500).json({ message: 'Erreur serveur', err });
  }
};

// Admin helper: set specialitesConcernees for a task
exports.setSpecialites = async (req, res) => {
  try {
    const id = req.params.id;
    const { specialitesConcernees } = req.body;
    if (!id) return res.status(400).json({ message: 'Id requis' });
    if (!specialitesConcernees || !Array.isArray(specialitesConcernees)) return res.status(400).json({ message: 'specialitesConcernees (array) requis' });

    const Tache = require('../models/Tache');
    const tache = await Tache.findByIdAndUpdate(id, { specialitesConcernees }, { new: true }).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });

    return res.json({ message: 'specialitesConcernees mises à jour', tache });
  } catch (err) {
    console.error('Erreur setSpecialites:', err);
    return res.status(500).json({ message: 'Erreur serveur', err });
  }
};

// Admin helper: derive specialites from task.type and set them
exports.ensureSpecialites = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    const Tache = require('../models/Tache');
    const tache = await Tache.findById(id).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });

    const normalizeStr = (v) => {
      if (v === null || v === undefined) return null;
      let s = String(v).trim().toLowerCase();
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      s = s.replace(/\s+/g, '_');
      s = s.replace(/[^a-z0-9_]/g, '_');
      return s;
    };

    const canonicalMap = {
      'pedagogique': 'PEDAGOGIQUE', 'pédagogique': 'PEDAGOGIQUE', 'formateur': 'PEDAGOGIQUE',
      'orientation': 'ORIENTATION', 'planification': 'PLANIFICATION',
      'services_financiers': 'SERVICES_FINANCIERS', 'finance': 'SERVICES_FINANCIERS'
    };

    const taskType = tache.type || tache.specialite || null;
    const taskTypeNorm = normalizeStr(taskType);
    const mapped = canonicalMap[taskTypeNorm];
    if (!mapped) return res.status(400).json({ message: 'Impossible de déduire specialites depuis task.type', taskType, taskTypeNorm });

    const updated = await Tache.findByIdAndUpdate(id, { specialitesConcernees: [mapped] }, { new: true }).lean();
    return res.json({ message: 'specialitesConcernees déduites et mises à jour', tache: updated });
  } catch (err) {
    console.error('Erreur ensureSpecialites:', err);
    return res.status(500).json({ message: 'Erreur serveur', err });
  }
};