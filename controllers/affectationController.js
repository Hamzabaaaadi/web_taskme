const mongoose = require('mongoose');

// Helper: ensure SEMIAUTO affectations have auditeurId as object {_id, nom, prenom}
async function enrichSemiAutoNames(affectations) {
  if (!Array.isArray(affectations) || affectations.length === 0) return;
  try {
    const ids = [];
    for (const a of affectations) {
      if (a && a.mode === 'SEMIAUTO') {
        const aid = a.auditeurId && (typeof a.auditeurId === 'string' ? a.auditeurId : (a.auditeurId && (a.auditeurId._id || a.auditeurId.id) ? (a.auditeurId._id || a.auditeurId.id) : null));
        if (aid) ids.push(String(aid));
      }
    }
    if (!ids.length) return;
    const uniq = [...new Set(ids)];

    const User = require('../models/User');
    const UserModel = User && (User.User || User.default || User);
    const Auditeur = (() => { try { return require('../models/Auditeur'); } catch (e) { return null; } })();
    const AudModel = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);

    const userMap = new Map();
    if (UserModel && typeof UserModel.find === 'function') {
      const users = await UserModel.find({ _id: { $in: uniq } }).lean();
      for (const u of users) userMap.set(String(u._id), u);
    }

    const audMap = new Map();
    if (AudModel && typeof AudModel.find === 'function') {
      const auds = await AudModel.find({ _id: { $in: uniq } }).lean();
      for (const au of (auds || [])) audMap.set(String(au._id), au);
    }

    for (const a of affectations) {
      if (!(a && a.mode === 'SEMIAUTO')) continue;
      const rawId = a.auditeurId && (typeof a.auditeurId === 'string' ? a.auditeurId : (a.auditeurId && (a.auditeurId._id || a.auditeurId.id) ? (a.auditeurId._id || a.auditeurId.id) : null));
      if (!rawId) {
        a.auditeurId = { _id: null, nom: null, prenom: null };
        continue;
      }
      let nom = null, prenom = null;
      if (userMap.has(String(rawId))) {
        const u = userMap.get(String(rawId));
        nom = u.nom || u.name || null;
        prenom = u.prenom || u.firstName || null;
      }
      if ((!nom && !prenom) && audMap.has(String(rawId))) {
        const au = audMap.get(String(rawId));
        // If Auditeur references a userId, try to resolve
        if (au && au.userId && UserModel && typeof UserModel.findById === 'function') {
          try {
            const linked = await UserModel.findById(au.userId).lean();
            if (linked) {
              nom = nom || linked.nom || linked.name || null;
              prenom = prenom || linked.prenom || linked.firstName || null;
            }
          } catch (e) {}
        }
        nom = nom || au.nom || au.name || null;
        prenom = prenom || au.prenom || au.firstName || null;
      }

      // final fallback: if auditeurId already object with nom/prenom, use them
      if ((!nom && !prenom) && a.auditeurId && typeof a.auditeurId === 'object') {
        nom = nom || a.auditeurId.nom || a.auditeurId.name || null;
        prenom = prenom || a.auditeurId.prenom || a.auditeurId.firstName || null;
      }

      // Replace auditeurId with object
      a.auditeurId = { _id: String(rawId), nom: nom || null, prenom: prenom || null };
    }
  } catch (e) {
    console.warn('enrichSemiAutoNames error:', e && e.message ? e.message : e);
  }
}

async function getMyAffectations(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    // Vérifier que l'utilisateur a le rôle AUDITEUR
    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé. Seuls les auditeurs peuvent accéder à leurs affectations.' });
    }

    const auditeurId = current._id;

    // Find any Auditeur documents that reference this user (some affectations
    // store auditeur IDs from the `auditeurs` collection instead of `users`).
    let auditeurIdsFromAudCollection = [];
    try {
      const Auditeur = (() => { try { return require('../models/Auditeur'); } catch (e) { return null; } })();
      const AudModel = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);
      if (AudModel && typeof AudModel.find === 'function') {
        const auds = await AudModel.find({ userId: current._id }).lean();
        if (auds && auds.length) auditeurIdsFromAudCollection = auds.map(a => a._id);
      }
    } catch (e) {
      // ignore
    }

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

        // Chercher les affectations où l'auditeur est:
        // - directement dans auditeurId (ObjectId/string)
        // - auditeurId._id (parfois stocké comme objet)
        // - ou présent dans le rapportAffectation.candidats (SEMIAUTO où l'id est uniquement dans le rapport)
        // Build OR query covering both ObjectId and string storage formats,
        // and include any auditeur IDs coming from the `auditeurs` collection.
        const queryIdStr = String(queryId);
        const orQuery = [
          { auditeurId: queryId },
          { auditeurId: queryIdStr },
          { 'auditeurId._id': queryId },
          { 'auditeurId._id': queryIdStr },
          { 'rapportAffectation.candidats.auditeurId': queryId },
          { 'rapportAffectation.candidats.auditeurId': queryIdStr }
        ];
        if (auditeurIdsFromAudCollection && auditeurIdsFromAudCollection.length) {
          orQuery.push({ auditeurId: { $in: auditeurIdsFromAudCollection } });
          orQuery.push({ auditeurId: { $in: auditeurIdsFromAudCollection.map(String) } });
          orQuery.push({ 'auditeurId._id': { $in: auditeurIdsFromAudCollection } });
          orQuery.push({ 'auditeurId._id': { $in: auditeurIdsFromAudCollection.map(String) } });
          orQuery.push({ 'rapportAffectation.candidats.auditeurId': { $in: auditeurIdsFromAudCollection } });
          orQuery.push({ 'rapportAffectation.candidats.auditeurId': { $in: auditeurIdsFromAudCollection.map(String) } });
        }

        const affectations = await Model.find({ $or: orQuery })
          .populate('tacheId', 'nom description statut')
          .populate('auditeurId', 'nom prenom email')
          .sort({ dateAffectation: -1 })
          .lean();

        // If populate failed (auditeurId === null), fetch raw auditeurId from collection and fill it.
        try {
          const col = mongoose.connection.collection('affectations');
          const ids = (affectations || []).map(a => a._id);
          if (ids.length > 0) {
            const rawDocs = await col.find({ _id: { $in: ids } }).project({ auditeurId: 1 }).toArray();
            const rawMap = new Map(rawDocs.map(d => [d._id.toString(), d.auditeurId]));
            for (const a of affectations) {
              if ((a.auditeurId === null || a.auditeurId === undefined) && rawMap.has(a._id.toString())) {
                a.auditeurId = rawMap.get(a._id.toString());
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch raw auditeurId fallback:', e && e.message ? e.message : e);
        }

        // Ensure `mode` is present for each affectation (default to MANUELLE)
        const normalized = (affectations || []).map(a => { if (!a.mode) a.mode = 'MANUELLE'; return a; });

        // If an affectation has no auditeurId but the current user appears in
        // rapportAffectation.candidats, mark it as proposed for the current user
        // and fill auditeurId with minimal info so the front can display it.
        try {
          for (const a of normalized) {
            if (a && !a.auditeurId) {
              try {
                const rap = a.rapportAffectation || a.report || null;
                if (rap && Array.isArray(rap.candidats) && rap.candidats.length) {
                  const idx = rap.candidats.findIndex(c => String(c.auditeurId) === String(current._id) || String(c._id) === String(current._id));
                  if (idx !== -1) {
                    const cand = rap.candidats[idx] || {};
                    const nom = cand.nom || cand.name || current.nom || null;
                    const prenom = cand.prenom || cand.firstName || current.prenom || null;
                    a.auditeurId = { _id: String(current._id), nom: nom, prenom: prenom };
                    a.proposedToCurrentUser = true;
                    a.propositionScore = cand && (cand.score || cand.probability || cand.confidence) ? (cand.score || cand.probability || cand.confidence) : null;
                    a.candidateIndex = idx;
                  }
                }
              } catch (e) {
                // ignore per-item errors
              }
            }
          }
        } catch (e) {}

        // For SEMIAUTO affectations: if auditeurId is present but not populated,
        // fetch user names in batch and attach auditeurNom / auditeurPrenom to response.
        try {
          const User = require('../models/User');
          const UserModel = User && (User.User || User.default || User);
          const Auditeur = (() => { try { return require('../models/Auditeur'); } catch (e) { return null; } })();
          const AudModel = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);

          if (UserModel && typeof UserModel.find === 'function') {
            const idsToFetch = [];
            for (const a of normalized) {
              if (a.mode === 'SEMIAUTO') {
                const aid = a.auditeurId && (typeof a.auditeurId === 'string' ? a.auditeurId : (a.auditeurId && (a.auditeurId._id || a.auditeurId.id) ? (a.auditeurId._id || a.auditeurId.id) : null));
                if (aid) idsToFetch.push(aid.toString());
              }
            }
            if (idsToFetch.length) {
              const uniq = [...new Set(idsToFetch)];
              const users = await UserModel.find({ _id: { $in: uniq } }).lean();
              const userMap = new Map(users.map(u => [String(u._id), u]));

              // If some ids are missing in User, try Auditeur collection
              const missingIds = uniq.filter(id => !userMap.has(id));
              let audMap = new Map();
              if (missingIds.length && AudModel && typeof AudModel.find === 'function') {
                const auds = await AudModel.find({ _id: { $in: missingIds } }).lean();
                audMap = new Map((auds || []).map(x => [String(x._id), x]));
              }

              for (const a of normalized) {
                if (a.mode === 'SEMIAUTO') {
                  const aid = a.auditeurId && (typeof a.auditeurId === 'string' ? a.auditeurId : (a.auditeurId && (a.auditeurId._id || a.auditeurId.id) ? (a.auditeurId._id || a.auditeurId.id) : null));
                  if (!aid) continue;
                  let nom = null, prenom = null;
                  if (userMap.has(String(aid))) {
                    const u = userMap.get(String(aid));
                    nom = u.nom || u.name || null;
                    prenom = u.prenom || u.firstName || null;
                  } else if (audMap && audMap.has(String(aid))) {
                    const au = audMap.get(String(aid));
                    if (au && au.userId && UserModel && typeof UserModel.findById === 'function') {
                      try {
                        const linkedUser = await UserModel.findById(au.userId).lean();
                        if (linkedUser) {
                          nom = linkedUser.nom || linkedUser.name || null;
                          prenom = linkedUser.prenom || linkedUser.firstName || null;
                        }
                      } catch (e) {
                        // ignore and fall through to try other sources
                      }
                    }
                    if (!nom && !prenom) {
                      nom = au.nom || au.name || null;
                      prenom = au.prenom || au.firstName || null;
                    }
                  }

                  // As a last resort, try to extract from rapportAffectation.candidats
                  if ((!nom && !prenom)) {
                    try {
                      const rap = a.rapportAffectation || a.report || null;
                      if (rap && Array.isArray(rap.candidats)) {
                        const cand = rap.candidats.find(c => String(c.auditeurId) === String(aid) || String(c._id) === String(aid));
                        if (cand) {
                          nom = cand.nom || cand.name || null;
                          prenom = cand.prenom || cand.firstName || null;
                        }
                      }
                    } catch (e) {
                      // ignore
                    }
                  }

                  // Replace auditeurId string with object containing _id, nom, prenom
                  a.auditeurId = { _id: aid, nom: nom || null, prenom: prenom || null };
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not enrich SEMIAUTO affectations with user names (fallbacks attempted):', e && e.message ? e.message : e);
        }

        await enrichSemiAutoNames(normalized);
        return res.json({ message: 'Affectations récupérées avec succès', count: normalized.length, affectations: normalized });
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
    const queryIdStr = String(queryId);

    const orQueryRaw = [
      { auditeurId: queryId },
      { auditeurId: queryIdStr },
      { 'auditeurId._id': queryId },
      { 'auditeurId._id': queryIdStr },
      { 'rapportAffectation.candidats.auditeurId': queryId },
      { 'rapportAffectation.candidats.auditeurId': queryIdStr }
    ];

    try {
      if (auditeurIdsFromAudCollection && auditeurIdsFromAudCollection.length) {
        orQueryRaw.push({ auditeurId: { $in: auditeurIdsFromAudCollection } });
        orQueryRaw.push({ auditeurId: { $in: auditeurIdsFromAudCollection.map(String) } });
        orQueryRaw.push({ 'auditeurId._id': { $in: auditeurIdsFromAudCollection } });
        orQueryRaw.push({ 'auditeurId._id': { $in: auditeurIdsFromAudCollection.map(String) } });
        orQueryRaw.push({ 'rapportAffectation.candidats.auditeurId': { $in: auditeurIdsFromAudCollection } });
        orQueryRaw.push({ 'rapportAffectation.candidats.auditeurId': { $in: auditeurIdsFromAudCollection.map(String) } });
      }
    } catch (e) {}

    const affectations = await col.find({ $or: orQueryRaw }).toArray();
    const normalized = (affectations || []).map(a => { if (!a.mode) a.mode = 'MANUELLE'; return a; });

    await enrichSemiAutoNames(normalized);
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

        // Fill raw auditeurId when populate returned null
        try {
          const col = mongoose.connection.collection('affectations');
          const ids = (affectations || []).map(a => a._id);
          if (ids.length > 0) {
            const rawDocs = await col.find({ _id: { $in: ids } }).project({ auditeurId: 1 }).toArray();
            const rawMap = new Map(rawDocs.map(d => [d._id.toString(), d.auditeurId]));
            for (const a of affectations) {
              if ((a.auditeurId === null || a.auditeurId === undefined) && rawMap.has(a._id.toString())) {
                a.auditeurId = rawMap.get(a._id.toString());
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch raw auditeurId fallback:', e && e.message ? e.message : e);
        }

        // ensure `mode` is present (schema default should handle new docs)
        const normalized = (affectations || []).map(a => { if (!a.mode) a.mode = 'MANUELLE'; return a; });

        await enrichSemiAutoNames(normalized);
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
    // Ensure SEMIAUTO auditeurId is an object {_id, nom, prenom} for consistency
    for (const a of normalized) {
      if (a.mode === 'SEMIAUTO') {
        const aid = a.auditeurId && (typeof a.auditeurId === 'string' ? a.auditeurId : (a.auditeurId && (a.auditeurId._id || a.auditeurId.id) ? (a.auditeurId._id || a.auditeurId.id) : null));
        if (aid && typeof a.auditeurId === 'string') {
          a.auditeurId = { _id: aid, nom: null, prenom: null };
        }
      }
    }
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

        // Allow acceptance when:
        // - existing.auditeurId matches the current user (string or object)
        // - existing.auditeurId matches an Auditeur doc linked to current user
        // - existing has rapportAffectation.candidats where a candidate matches current user (by auditeurId or user id)
        let allowed = false;
        const userIdStr = String(current._id);
        // gather auditeur ids linked to this user
        let auditeurIdsFromAudCollection = [];
        try {
          const Auditeur = (() => { try { return require('../models/Auditeur'); } catch (e) { return null; } })();
          const AudModel = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);
          if (AudModel && typeof AudModel.find === 'function') {
            const auds = await AudModel.find({ userId: current._id }).lean();
            if (auds && auds.length) auditeurIdsFromAudCollection = auds.map(a => String(a._id));
          }
        } catch (e) {}

        const existingAudId = existing.auditeurId && (typeof existing.auditeurId === 'string' ? existing.auditeurId : (existing.auditeurId && (existing.auditeurId._id || existing.auditeurId.id) ? String(existing.auditeurId._id || existing.auditeurId.id) : null));
        if (existingAudId) {
          if (existingAudId === userIdStr) allowed = true;
          if (auditeurIdsFromAudCollection.includes(existingAudId)) allowed = true;
        }

        if (!existingAudId) {
          try {
            const rap = existing.rapportAffectation || existing.report || null;
            if (rap && Array.isArray(rap.candidats)) {
              const idx = rap.candidats.findIndex(c => String(c.auditeurId) === userIdStr || String(c.auditeurId) === userIdStr || String(c._id) === userIdStr || auditeurIdsFromAudCollection.includes(String(c.auditeurId)));
              if (idx !== -1) allowed = true;
            }
          } catch (e) {}
        }

        if (!allowed) {
          // If auditeurId exists but is an ObjectId referencing User, compare as ObjectId
          try {
            if (existing.auditeurId && String(existing.auditeurId) === userIdStr) allowed = true;
          } catch (e) {}
        }

        if (!allowed) {
          return res.status(403).json({ message: 'Vous n\'êtes pas l\'auditeur assigné' });
        }

        // Determine which auditeurId to persist: prefer auditeur doc id if present, else user id
        let audToSet = null;
        if (auditeurIdsFromAudCollection && auditeurIdsFromAudCollection.length) {
          // if any candidate matches an auditeur id from aud collection, use that one
          try {
            const rap = existing.rapportAffectation || existing.report || null;
            if (rap && Array.isArray(rap.candidats)) {
              const match = rap.candidats.find(c => auditeurIdsFromAudCollection.includes(String(c.auditeurId)));
              if (match) audToSet = match.auditeurId;
            }
          } catch (e) {}
          // fallback to first auditeur id
          if (!audToSet) audToSet = auditeurIdsFromAudCollection[0];
        }
        if (!audToSet) audToSet = current._id;

        const updated = await Model.findByIdAndUpdate(queryId, { $set: { statut: 'ACCEPTEE', dateReponse: new Date(), auditeurId: audToSet } }, { new: true }).lean();
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

    await col.updateOne({ _id: queryId }, { $set: { statut: 'ACCEPTEE', dateReponse: new Date() } });
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

        // Similar permissive check as acceptAffectation: allow refuse when
        // candidate list includes current user or auditeurId matches.
        let allowed = false;
        const userIdStr = String(current._id);
        let auditeurIdsFromAudCollection = [];
        try {
          const Auditeur = (() => { try { return require('../models/Auditeur'); } catch (e) { return null; } })();
          const AudModel = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);
          if (AudModel && typeof AudModel.find === 'function') {
            const auds = await AudModel.find({ userId: current._id }).lean();
            if (auds && auds.length) auditeurIdsFromAudCollection = auds.map(a => String(a._id));
          }
        } catch (e) {}

        const existingAudId = existing.auditeurId && (typeof existing.auditeurId === 'string' ? existing.auditeurId : (existing.auditeurId && (existing.auditeurId._id || existing.auditeurId.id) ? String(existing.auditeurId._id || existing.auditeurId.id) : null));
        if (existingAudId) {
          if (existingAudId === userIdStr) allowed = true;
          if (auditeurIdsFromAudCollection.includes(existingAudId)) allowed = true;
        }

        if (!existingAudId) {
          try {
            const rap = existing.rapportAffectation || existing.report || null;
            if (rap && Array.isArray(rap.candidats)) {
              const idx = rap.candidats.findIndex(c => String(c.auditeurId) === userIdStr || auditeurIdsFromAudCollection.includes(String(c.auditeurId)) || String(c._id) === userIdStr);
              if (idx !== -1) allowed = true;
            }
          } catch (e) {}
        }

        if (!allowed) {
          try {
            if (existing.auditeurId && String(existing.auditeurId) === userIdStr) allowed = true;
          } catch (e) {}
        }

        if (!allowed) {
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

// --- Fonctions IA / automatisation ---
// Proposer une affectation en utilisant le service IA (ou fallback)
async function proposerIA(req, res) {
  try {
    const { tacheId, internalSecret } = req.body || {};
    if (!tacheId) return res.status(400).json({ message: 'tacheId requis' });

    // Si IA_INTERNAL_SECRET est défini dans l'environnement, exiger le secret
    const IA_SECRET = process.env.IA_INTERNAL_SECRET;
    if (IA_SECRET && IA_SECRET.length > 0) {
      if (!internalSecret || internalSecret !== IA_SECRET) {
        return res.status(403).json({ message: 'Secret interne IA invalide ou manquant' });
      }
    }

    const Tache = require('../models/Tache');
    const Affectation = require('../models/Affectation');
    let User = require('../models/User');
    // Support different module export styles (ESM named export, default, or CommonJS)
    User = User && (User.User || User.default || User);
    const iaService = require('../services/iaService');

    const tache = await Tache.findById(tacheId).lean();
    if (!tache) return res.status(404).json({ message: 'Tâche non trouvée' });

    // Charger candidats potentiels (filtrage de base: auditeurs actifs)
    // NOTE: on ne fait pas `.lean()` ici afin de pouvoir mettre à jour
    // le champ `embedding` sur les documents utilisateurs si nécessaire.
    const auditeurs = await User.find({ role: 'AUDITEUR', estActif: true });

    const rapport = await iaService.proposerAffectationIA(tache, auditeurs, {});

    // Créer une affectation brouillon avec le rapport (statut EN_ATTENTE)
    const draft = await Affectation.create({ tacheId, mode: 'AUTOMATIQUE_IA', rapportAffectation: { ...rapport, createdAt: new Date() }, statut: 'EN_ATTENTE' });

    // Remove sensitive/auxiliary fields from the rapport before returning to client
    const rapportClean = JSON.parse(JSON.stringify(rapport));
    if (rapportClean && typeof rapportClean === 'object') {
      delete rapportClean.modelVersion;
      delete rapportClean.confidenceScore;
    }

    return res.json({ message: 'Proposition IA générée', rapport: rapportClean });
  } catch (err) {
    console.error('proposerIA error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

// Valider ou refuser une proposition IA / draft
async function validerIA(req, res) {
  try {
    const id = req.params.id;
    const { decision, justificatif, internalSecret } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Id requis' });
    if (!decision) return res.status(400).json({ message: 'decision requis (accept|refuse)' });

    // Vérifier secret interne si configuré
    const IA_SECRET = process.env.IA_INTERNAL_SECRET;
    if (IA_SECRET && IA_SECRET.length > 0) {
      if (!internalSecret || internalSecret !== IA_SECRET) {
        return res.status(403).json({ message: 'Secret interne IA invalide ou manquant' });
      }
    }

    const Affectation = require('../models/Affectation');
    const aff = await Affectation.findById(id);
    if (!aff) return res.status(404).json({ message: 'Affectation non trouvée' });

    // Enregistrer la décision par l'utilisateur courant
    const current = req.user;
    const userId = current ? current._id : null;

    if (decision === 'accept') {
      const top = aff.rapportAffectation && aff.rapportAffectation.candidats && aff.rapportAffectation.candidats[0];
      if (!top) return res.status(400).json({ message: 'Aucun candidat proposé' });
      aff.auditeurId = top.auditeurId;
      aff.statut = 'ACCEPTEE';
      aff.estValidee = true;
      aff.decisionPar = userId;
      aff.dateReponse = new Date();
      aff.justificatifRefus = null;
    } else {
      aff.statut = 'REFUSEE';
      aff.estValidee = false;
      aff.justificatifRefus = justificatif || null;
      aff.decisionPar = userId;
      aff.dateReponse = new Date();
    }

    await aff.save();
    return res.json({ message: 'Décision enregistrée', affectation: aff });
  } catch (err) {
    console.error('validerIA error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

// Exporter les nouvelles fonctions
async function updateAffectation(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    // Only allow coordinators or super admins to modify arbitrary affectations
    if (!['COORDINATEUR', 'SUPER_ADMIN'].includes(current.role)) {
      return res.status(403).json({ message: "Accès refusé. Rôle insuffisant pour modifier l'affectation." });
    }

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });

    const allowedFields = ['mode', 'tacheId', 'auditeurId', 'dateAffectation', 'estValidee'];
    const payload = req.body || {};
    const updates = {};
    for (const k of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        updates[k] = payload[k];
      }
    }

    // Basic validation
    if (updates.mode) {
      const allowedModes = ['MANUELLE','SEMIAUTO','AUTOMATIQUE_IA'];
      if (!allowedModes.includes(updates.mode)) {
        return res.status(400).json({ message: `mode invalide. Valeurs autorisées: ${allowedModes.join(', ')}` });
      }
    }

    // If estValidee is explicitly set to true, set dateReponse
    if (Object.prototype.hasOwnProperty.call(updates, 'estValidee') && updates.estValidee === true) {
      updates.dateReponse = new Date();
    }

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

        const updated = await Model.findByIdAndUpdate(queryId, { $set: updates }, { new: true }).lean();
        return res.json({ message: 'Affectation mise à jour', affectation: updated });
      }
    } catch (e) {
      console.warn('updateAffectation model path failed, falling back to raw collection:', e && e.message ? e.message : e);
    }

    // Fallback to raw collection
    const mongooseLib = require('mongoose');
    const col = mongooseLib.connection.collection('affectations');
    const { ObjectId } = mongooseLib.Types;
    let queryId = id;
    try { queryId = new ObjectId(id); } catch (e) { }

    const aff = await col.findOne({ _id: queryId });
    if (!aff) return res.status(404).json({ message: 'Affectation non trouvée' });

    await col.updateOne({ _id: queryId }, { $set: updates });
    const updatedDoc = await col.findOne({ _id: queryId });
    return res.json({ message: 'Affectation mise à jour', affectation: updatedDoc });
  } catch (err) {
    console.error('updateAffectation error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { getMyAffectations, list, acceptAffectation, refuseAffectation, deleteAffectation, proposerIA, validerIA, updateAffectation };
