const mongoose = require('mongoose');

async function getMyDelegations(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });

    // Vérifier que l'utilisateur a le rôle AUDITEUR
    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé. Seuls les auditeurs peuvent accéder à leurs délégations.' });
    }

    const auditeurProposeId = current._id;

    // Try Mongoose model first
    try {
      const Delegation = require('../models/Delegation');
      const Model = Delegation && (Delegation.Delegation || Delegation.default || Delegation);
      
      if (Model && typeof Model.find === 'function') {
        // Convertir l'ID en ObjectId si nécessaire
        const { ObjectId } = mongoose.Types;
        let queryId = auditeurProposeId;
        try { 
          queryId = new ObjectId(auditeurProposeId); 
        } catch (e) { 
          // garder l'ID tel quel si conversion échoue
        }

        const delegations = await Model.find({ auditeurPropose: queryId })
          .populate('affectationOriginale')
          .populate('auditeurInitial', 'nom prenom email')
          .populate('auditeurPropose', 'nom prenom email')
          .sort({ dateProposition: -1 })
          .lean();

        return res.json({ 
          message: 'Délégations récupérées avec succès',
          count: delegations.length,
          delegations 
        });
      }
    } catch (e) {
      console.error('Mongoose model error:', e);
      // ignore, fallback to raw collection
    }

    // Fallback to raw collection
    const col = mongoose.connection.collection('delegations');
    const { ObjectId } = mongoose.Types;
    let queryId = auditeurProposeId;
    try { 
      queryId = new ObjectId(auditeurProposeId); 
    } catch (e) { 
      // garder l'ID tel quel si conversion échoue
    }

    const delegations = await col.find({ auditeurPropose: queryId }).toArray();
    
    return res.json({ 
      message: 'Délégations récupérées avec succès',
      count: delegations.length,
      delegations 
    });
  } catch (err) {
    console.error('Get my delegations error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

// Fonction helper pour mettre à jour le statut d'une délégation
async function updateDelegationStatus(req, res, newStatus, successMessage) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const delegationId = req.params.id;
    if (!delegationId) return res.status(400).json({ message: 'Id de délégation requis' });

    const { ObjectId } = mongoose.Types;
    let queryId = delegationId;
    let queryAuditeurId = current._id;
    try { 
      queryId = new ObjectId(delegationId);
      queryAuditeurId = new ObjectId(current._id);
    } catch (e) {}

    // Try Mongoose model first
    try {
      const Delegation = require('../models/Delegation');
      const Model = Delegation && (Delegation.Delegation || Delegation.default || Delegation);
      
      if (Model && typeof Model.findOneAndUpdate === 'function') {
        // Vérifier et mettre à jour en une seule requête
        const updated = await Model.findOneAndUpdate(
          { 
            _id: queryId,
            auditeurPropose: queryAuditeurId,
            statut: 'EN_ATTENTE'
          },
          { 
            $set: { 
              statut: newStatus,
              dateReponse: new Date()
            }
          },
          { new: true }
        )
          .populate('affectationOriginale')
          .populate('auditeurInitial', 'nom prenom email')
          .populate('auditeurPropose', 'nom prenom email')
          .lean();

        if (!updated) {
          // Vérifier si la délégation existe
          const exists = await Model.findById(queryId).lean();
          if (!exists) return res.status(404).json({ message: 'Délégation non trouvée' });
          if (exists.statut !== 'EN_ATTENTE') {
            return res.status(400).json({ message: 'Cette délégation a déjà été traitée' });
          }
          return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette délégation' });
        }

        return res.json({ message: successMessage, delegation: updated });
      }
    } catch (e) {
      console.error('Mongoose model error:', e);
    }

    // Fallback to raw collection
    const col = mongoose.connection.collection('delegations');
    const delegation = await col.findOne({ _id: queryId });
    
    if (!delegation) return res.status(404).json({ message: 'Délégation non trouvée' });
    if (delegation.statut !== 'EN_ATTENTE') {
      return res.status(400).json({ message: 'Cette délégation a déjà été traitée' });
    }
    
    const delegationAuditeurId = delegation.auditeurPropose?.toString() || delegation.auditeurPropose;
    if (delegationAuditeurId !== queryAuditeurId.toString() && delegationAuditeurId !== current._id.toString()) {
      return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette délégation' });
    }

    await col.updateOne(
      { _id: queryId },
      { $set: { statut: newStatus, dateReponse: new Date() } }
    );

    const updated = await col.findOne({ _id: queryId });
    return res.json({ message: successMessage, delegation: updated });
  } catch (err) {
    console.error('Update delegation status error:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function accepterDelegation(req, res) {
  return updateDelegationStatus(req, res, 'ACCEPTEE', 'Délégation acceptée avec succès');
}

async function refuserDelegation(req, res) {
  return updateDelegationStatus(req, res, 'REFUSEE', 'Délégation refusée avec succès');
}

module.exports = { getMyDelegations, accepterDelegation, refuserDelegation };
