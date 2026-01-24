exports.assign = async (req, res) => {
  // Affecter un ou plusieurs auditeurs à une tâche
  try {
    const { auditeurId, mode } = req.body;
    // Normalize auditeurId: accept string, object with _id/id, or array
    function resolveAuditeurId(raw) {
      if (!raw) return null;
      if (Array.isArray(raw)) return resolveAuditeurId(raw[0]);
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'object') {
        if (raw._id) return String(raw._id);
        if (raw.id) return String(raw.id);
        // sometimes front-end may send nested object like { auditeurId: { _id: '...' } }
        for (const k of Object.keys(raw)) {
          const v = raw[k];
          if (v && (typeof v === 'string' || typeof v === 'object')) {
            const candidate = resolveAuditeurId(v);
            if (candidate) return candidate;
          }
        }
      }
      return null;
    }
    const resolvedAuditeurId = resolveAuditeurId(auditeurId);
    if (!resolvedAuditeurId) {
      return res.status(400).json({ error: 'auditeurId requis ou invalide' });
    }
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
      auditeurId: resolvedAuditeurId,
      mode: chosenMode,
      dateAffectation: new Date()
    });
    await affectation.save();

    // Create and send notification via service (persist + realtime/email)
    try {
      const notificationService = require('../services/notificationService');
      await notificationService.createAndSend({
        type: 'AFFECTATION',
        titre: chosenMode === 'SEMIAUTO' ? 'Proposition d\'affectation' : 'Affectation',
        message: `Vous avez une nouvelle ${chosenMode === 'SEMIAUTO' ? 'proposition' : 'affectation'} pour la tâche: ${tache && tache.nom ? tache.nom : String(tacheId)}`,
        data: { tacheId: tacheId },
        recipients: [resolvedAuditeurId],
        sendEmail: false,
        realtime: true
      });
    } catch (e) {
      console.warn('Failed to create/send notification for affectation:', e && e.message ? e.message : e);
    }

    return res.status(201).json({
      message: "Affectation créée avec succès",
      affectationId: affectation._id,
      tacheId,
      auditeurId: resolvedAuditeurId
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

// Retourne le nombre total de taches, la répartition rémunérées/non rémunérées
// et la répartition par types (pédagogique, orientation, planification, services_financiers).
// Les autres filtres passés en query sont appliqués, à l'exception de `estRemuneree`
// qui est géré séparément pour la partie rémunération.
exports.count = async (req, res) => {
  try {
    const rawQuery = req.query || {};
    // Construire un filtre de base en excluant explicitement `estRemuneree`
    // pour pouvoir calculer séparément les comptes rémunérées / non rémunérées.
    const baseFilter = { ...rawQuery };
    if (Object.prototype.hasOwnProperty.call(baseFilter, 'estRemuneree')) {
      delete baseFilter.estRemuneree;
    }

    const remunereeFilter = { ...baseFilter, estRemuneree: true };
    const nonRemunereeFilter = { ...baseFilter, estRemuneree: false };

    // Categories à compter (clé exposée -> valeur canonique utilisée dans specialitesConcernees)
    const categories = [
      { key: 'pédagogique', canon: 'pédagogique' },
      { key: 'orientation', canon: 'ORIENTATION' },
      { key: 'planification', canon: 'PLANIFICATION' },
      { key: 'services_financiers', canon: 'SERVICES_FINANCIERS' }
    ];

    // Pour chaque catégorie, compter les tâches dont `specialitesConcernees` contient la valeur
    // ou dont `type` correspond (cas-insensitif) à la valeur canonique.
    const typeCountPromises = categories.map(cat => {
      const filter = {
        ...baseFilter,
        $or: [
          { specialitesConcernees: cat.canon },
          { type: { $regex: `^${cat.canon}$`, $options: 'i' } }
        ]
      };
      return Tache.countDocuments(filter).then(count => ({ key: cat.key, count }));
    });

    const [countRemuneree, countNonRemuneree, ...typeCountsResults] = await Promise.all([
      Tache.countDocuments(remunereeFilter),
      Tache.countDocuments(nonRemunereeFilter),
      ...typeCountPromises
    ]);

    const total = countRemuneree + countNonRemuneree;

    const countsByType = typeCountsResults.reduce((acc, cur) => {
      acc[cur.key] = cur.count;
      return acc;
    }, {});

    res.json({ count: total, countRemuneree, countNonRemuneree, countsByType });
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
    // Accept `status` as an alias for the French `statut` field
    if (req.body && req.body.status) {
      const allowed = ['CREEE','EN_ATTENTE_AFFECTATION','AFFECTEE','EN_COURS','TERMINEE','ANNULEE'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({ message: `status invalide. Valeurs autorisées: ${allowed.join(', ')}` });
      }
      req.body.statut = req.body.status;
      delete req.body.status;
    }
    const tache = await Tache.create(req.body);
    res.status(201).json({ tache });
  } catch (err) {
    console.error('Erreur création tâche:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message, stack: err.stack });
  }
};

exports.update = async (req, res) => {
  try {
    // Accept `status` as an alias for the French `statut` field in update requests
    if (req.body && req.body.status) {
      const allowed = ['CREEE','EN_ATTENTE_AFFECTATION','AFFECTEE','EN_COURS','TERMINEE','ANNULEE'];
      if (!allowed.includes(req.body.status)) {
        return res.status(400).json({ message: `status invalide. Valeurs autorisées: ${allowed.join(', ')}` });
      }
      req.body.statut = req.body.status;
      delete req.body.status;
    }

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