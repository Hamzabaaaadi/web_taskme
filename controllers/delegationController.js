const mongoose = require('mongoose');
const Delegation = require('../models/Delegation');
const Affectation = require('../models/Affectation');

/* ================================
   CREER UNE DELEGATION
================================ */
async function createDelegation(req, res) {
  try {
    const {
      affectationOriginale,
      auditeurInitial,
    auditeurPropose,
      justification
    } = req.body;

    if (!affectationOriginale || !auditeurInitial || !auditeurPropose) {
      return res.status(400).json({
        message: 'Champs obligatoires manquants'
      });
    }

    if (auditeurInitial === auditeurPropose) {
      return res.status(400).json({
        message: 'Impossible de déléguer à soi-même'
      });
    }

    const delegation = new Delegation({
      affectationOriginale,
      auditeurInitial,
      auditeurPropose,
      justification
    });

    await delegation.save();

    // Mettre à jour l'affectation originale : statut -> DELEGUEE et lier la délégation
    let updatedAffectation = null;
    try {
      updatedAffectation = await Affectation.findByIdAndUpdate(
        affectationOriginale,
        { statut: 'DELEGUEE', delegation: delegation._id },
        { new: true }
      );
    } catch (err) {
      console.error('Erreur lors de la mise à jour de l\'affectation:', err);
    }

    return res.status(201).json({
      message: 'Délégation créée avec succès',
      delegation,
      affectation: updatedAffectation
    });

  } catch (error) {
    console.error('createDelegation error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   MES DELEGATIONS (AUDITEUR)
================================ */
async function getMyDelegations(req, res) {
  try {
    const current = req.user;
    if (!current) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const delegations = await Delegation.find({
      auditeurPropose: current._id
    })
      .populate('affectationOriginale')
      .populate('auditeurInitial', 'nom prenom email')
      .populate('auditeurPropose', 'nom prenom email')
      .sort({ dateProposition: -1 });

    return res.json({
      message: 'Délégations récupérées avec succès',
      count: delegations.length,
      delegations
    });

  } catch (error) {
    console.error('getMyDelegations error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   MES DELEGATIONS CREEES (AUDITEUR)
   Délégations proposées / émises par l'auditeur connecté
================================ */
async function getMyProposedDelegations(req, res) {
  try {
    const current = req.user;
    if (!current) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const delegations = await Delegation.find({
      auditeurInitial: current._id
    })
      .populate('affectationOriginale')
      .populate('auditeurInitial', 'nom prenom email')
      .populate('auditeurPropose', 'nom prenom email')
      .sort({ dateProposition: -1 });

    return res.json({
      message: 'Délégations créées récupérées avec succès',
      count: delegations.length,
      delegations
    });

  } catch (error) {
    console.error('getMyProposedDelegations error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   MODIFIER UNE DELEGATION
   Seul l'auditeur initial peut modifier si statut = EN_ATTENTE
================================ */
async function updateDelegation(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') return res.status(403).json({ message: 'Accès refusé' });

    const delegationId = req.params.id;
    if (!delegationId) return res.status(400).json({ message: 'Id de délégation requis' });

    const delegation = await Delegation.findById(delegationId);
    if (!delegation) return res.status(404).json({ message: 'Délégation non trouvée' });

    if (delegation.auditeurInitial?.toString() !== current._id.toString()) {
      return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette délégation' });
    }

    if (delegation.statut !== 'EN_ATTENTE') {
      return res.status(400).json({ message: 'Impossible de modifier une délégation déjà traitée' });
    }

    const { auditeurPropose, justification } = req.body;
    if (auditeurPropose && auditeurPropose.toString() === delegation.auditeurInitial?.toString()) {
      return res.status(400).json({ message: 'Impossible de déléguer à soi-même' });
    }

    if (auditeurPropose) delegation.auditeurPropose = auditeurPropose;
    if (typeof justification !== 'undefined') delegation.justification = justification;

    await delegation.save();

    return res.json({ message: 'Délégation mise à jour avec succès', delegation });

  } catch (error) {
    console.error('updateDelegation error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   SUPPRIMER UNE DELEGATION
   Seul l'auditeur initial peut supprimer si statut = EN_ATTENTE
   et on remet l'affectation à EN_ATTENTE + clear delegation
================================ */
async function deleteDelegation(req, res) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') return res.status(403).json({ message: 'Accès refusé' });

    const delegationId = req.params.id;
    if (!delegationId) return res.status(400).json({ message: 'Id de délégation requis' });

    const delegation = await Delegation.findById(delegationId);
    if (!delegation) return res.status(404).json({ message: 'Délégation non trouvée' });

    if (delegation.auditeurInitial?.toString() !== current._id.toString()) {
      return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer cette délégation' });
    }

    if (delegation.statut !== 'EN_ATTENTE') {
      return res.status(400).json({ message: 'Impossible de supprimer une délégation déjà traitée' });
    }

    const affectationId = delegation.affectationOriginale;

    await Delegation.findByIdAndDelete(delegationId);

    if (affectationId) {
      try {
        await Affectation.findByIdAndUpdate(
          affectationId,
          { statut: 'EN_ATTENTE', delegation: null },
          { new: true }
        );
      } catch (err) {
        console.error('Erreur lors du rollback de l\'affectation:', err);
      }
    }

    return res.json({ message: 'Délégation supprimée avec succès' });

  } catch (error) {
    console.error('deleteDelegation error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   HELPER UPDATE STATUS
================================ */
async function updateDelegationStatus(req, res, newStatus, successMessage) {
  try {
    const current = req.user;
    if (!current) return res.status(401).json({ message: 'Non authentifié' });
    if (current.role !== 'AUDITEUR') {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const delegationId = req.params.id;
    if (!delegationId) {
      return res.status(400).json({ message: 'Id de délégation requis' });
    }

    const delegation = await Delegation.findOne({
      _id: delegationId,
      auditeurPropose: current._id,
      statut: 'EN_ATTENTE'
    });

    if (!delegation) {
      return res.status(404).json({
        message: 'Délégation non trouvée ou déjà traitée'
      });
    }

    delegation.statut = newStatus;
    delegation.dateReponse = new Date();
    await delegation.save();

    return res.json({
      message: successMessage,
      delegation
    });

  } catch (error) {
    console.error('updateDelegationStatus error:', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/* ================================
   ACCEPTER / REFUSER
================================ */
async function accepterDelegation(req, res) {
  return updateDelegationStatus(
    req,
    res,
    'ACCEPTEE',
    'Délégation acceptée avec succès'
  );
}

async function refuserDelegation(req, res) {
  return updateDelegationStatus(
    req,
    res,
    'REFUSEE',
    'Délégation refusée avec succès'
  );
}

/* ================================
   EXPORTS
================================ */
module.exports = {
  createDelegation,
  getMyDelegations,
  getMyProposedDelegations,
  updateDelegation,
  deleteDelegation,
  accepterDelegation,
  refuserDelegation
};














// const mongoose = require('mongoose');

// async function getMyDelegations(req, res) {
//   try {
//     const current = req.user;
//     if (!current) return res.status(401).json({ message: 'Non authentifié' });

//     // Vérifier que l'utilisateur a le rôle AUDITEUR
//     if (current.role !== 'AUDITEUR') {
//       return res.status(403).json({ message: 'Accès refusé. Seuls les auditeurs peuvent accéder à leurs délégations.' });
//     }

//     const auditeurProposeId = current._id;

//     // Try Mongoose model first
//     try {
//       const Delegation = require('../models/Delegation');
//       const Model = Delegation && (Delegation.Delegation || Delegation.default || Delegation);
      
//       if (Model && typeof Model.find === 'function') {
//         // Convertir l'ID en ObjectId si nécessaire
//         const { ObjectId } = mongoose.Types;
//         let queryId = auditeurProposeId;
//         try { 
//           queryId = new ObjectId(auditeurProposeId); 
//         } catch (e) { 
//           // garder l'ID tel quel si conversion échoue
//         }

//         const delegations = await Model.find({ auditeurPropose: queryId })
//           .populate('affectationOriginale')
//           .populate('auditeurInitial', 'nom prenom email')
//           .populate('auditeurPropose', 'nom prenom email')
//           .sort({ dateProposition: -1 })
//           .lean();

//         return res.json({ 
//           message: 'Délégations récupérées avec succès',
//           count: delegations.length,
//           delegations 
//         });
//       }
//     } catch (e) {
//       console.error('Mongoose model error:', e);
//       // ignore, fallback to raw collection
//     }

//     // Fallback to raw collection
//     const col = mongoose.connection.collection('delegations');
//     const { ObjectId } = mongoose.Types;
//     let queryId = auditeurProposeId;
//     try { 
//       queryId = new ObjectId(auditeurProposeId); 
//     } catch (e) { 
//       // garder l'ID tel quel si conversion échoue
//     }

//     const delegations = await col.find({ auditeurPropose: queryId }).toArray();
    
//     return res.json({ 
//       message: 'Délégations récupérées avec succès',
//       count: delegations.length,
//       delegations 
//     });
//   } catch (err) {
//     console.error('Get my delegations error:', err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// }

// // Fonction helper pour mettre à jour le statut d'une délégation
// async function updateDelegationStatus(req, res, newStatus, successMessage) {
//   try {
//     const current = req.user;
//     if (!current) return res.status(401).json({ message: 'Non authentifié' });
//     if (current.role !== 'AUDITEUR') {
//       return res.status(403).json({ message: 'Accès refusé' });
//     }

//     const delegationId = req.params.id;
//     if (!delegationId) return res.status(400).json({ message: 'Id de délégation requis' });

//     const { ObjectId } = mongoose.Types;
//     let queryId = delegationId;
//     let queryAuditeurId = current._id;
//     try { 
//       queryId = new ObjectId(delegationId);
//       queryAuditeurId = new ObjectId(current._id);
//     } catch (e) {}

//     // Try Mongoose model first
//     try {
//       const Delegation = require('../models/Delegation');
//       const Model = Delegation && (Delegation.Delegation || Delegation.default || Delegation);
      
//       if (Model && typeof Model.findOneAndUpdate === 'function') {
//         // Vérifier et mettre à jour en une seule requête
//         const updated = await Model.findOneAndUpdate(
//           { 
//             _id: queryId,
//             auditeurPropose: queryAuditeurId,
//             statut: 'EN_ATTENTE'
//           },
//           { 
//             $set: { 
//               statut: newStatus,
//               dateReponse: new Date()
//             }
//           },
//           { new: true }
//         )
//           .populate('affectationOriginale')
//           .populate('auditeurInitial', 'nom prenom email')
//           .populate('auditeurPropose', 'nom prenom email')
//           .lean();

//         if (!updated) {
//           // Vérifier si la délégation existe
//           const exists = await Model.findById(queryId).lean();
//           if (!exists) return res.status(404).json({ message: 'Délégation non trouvée' });
//           if (exists.statut !== 'EN_ATTENTE') {
//             return res.status(400).json({ message: 'Cette délégation a déjà été traitée' });
//           }
//           return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette délégation' });
//         }

//         return res.json({ message: successMessage, delegation: updated });
//       }
//     } catch (e) {
//       console.error('Mongoose model error:', e);
//     }

//     // Fallback to raw collection
//     const col = mongoose.connection.collection('delegations');
//     const delegation = await col.findOne({ _id: queryId });
    
//     if (!delegation) return res.status(404).json({ message: 'Délégation non trouvée' });
//     if (delegation.statut !== 'EN_ATTENTE') {
//       return res.status(400).json({ message: 'Cette délégation a déjà été traitée' });
//     }
    
//     const delegationAuditeurId = delegation.auditeurPropose?.toString() || delegation.auditeurPropose;
//     if (delegationAuditeurId !== queryAuditeurId.toString() && delegationAuditeurId !== current._id.toString()) {
//       return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette délégation' });
//     }

//     await col.updateOne(
//       { _id: queryId },
//       { $set: { statut: newStatus, dateReponse: new Date() } }
//     );

//     const updated = await col.findOne({ _id: queryId });
//     return res.json({ message: successMessage, delegation: updated });
//   } catch (err) {
//     console.error('Update delegation status error:', err);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// }

// async function accepterDelegation(req, res) {
//   return updateDelegationStatus(req, res, 'ACCEPTEE', 'Délégation acceptée avec succès');
// }

// async function refuserDelegation(req, res) {
//   return updateDelegationStatus(req, res, 'REFUSEE', 'Délégation refusée avec succès');
// }



// const Delegation = require('../models/Delegation');

// exports.createDelegation = async (req, res) => {
//   try {
//     const {
//       affectationOriginale,
//       auditeurInitial,
//       auditeurPropose,
//       justification
//     } = req.body;

//     // Validation
//     if (!affectationOriginale || !auditeurInitial || !auditeurPropose) {
//       return res.status(400).json({
//         message: 'Champs obligatoires manquants'
//       });
//     }

//     if (auditeurInitial === auditeurPropose) {
//       return res.status(400).json({
//         message: 'Impossible de déléguer à soi-même'
//       });
//     }

//     const delegation = new Delegation({
//       affectationOriginale,
//       auditeurInitial,
//       auditeurPropose,
//       justification
//     });

//     await delegation.save();

//     return res.status(201).json({
//       message: 'Délégation créée avec succès',
//       delegation
//     });

//   } catch (error) {
//     console.error('createDelegation error:', error);
//     return res.status(500).json({ message: 'Erreur serveur' });
//   }
// };


// module.exports = { getMyDelegations, accepterDelegation, refuserDelegation };
