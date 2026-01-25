const mongoose = require('mongoose');

const AffectationSchema = new mongoose.Schema({
  id: String,
  tacheId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tache', required: true },
  auditeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  // mode: MANUELLE | SEMIAUTO | AUTOMATIQUE_IA
  mode: { type: String, enum: ['MANUELLE','SEMIAUTO','AUTOMATIQUE_IA'], default: 'MANUELLE' },
  dateAffectation: Date,
  statut: { type: String, enum: ['EN_ATTENTE','ACCEPTEE','REFUSEE','DELEGUEE','EXPIREE'], default: 'EN_ATTENTE' },
  justificatifRefus: String,
  rapportAlgorithme: String,
  estValidee: { type: Boolean, default: false },
  dateReponse: Date,
  delaiReponse: Date,
  delegation: { type: mongoose.Schema.Types.ObjectId, ref: 'Delegation', default: null }
}, { timestamps: true });

// Rapport/trace des propositions d'affectation (semi-auto ou IA),
// permet de garder la traçabilité des candidats proposés, des scores
// et de la version du modèle IA qui a généré la proposition.
AffectationSchema.add({
  rapportAffectation: {
    provenance: { type: String }, // 'SEMIAUTO' | 'IA'
    candidats: [{
      auditeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      nom: String,
      prenom: String,
      score: Number
    }],
    modelVersion: String,
    meta: mongoose.Schema.Types.Mixed,
    createdAt: Date
  },
  // utilisateur (coordinateur) ayant validé ou refusé la proposition
  decisionPar: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // score global/confidence éventuel renvoyé par l'IA
  confidenceScore: Number
});

module.exports = mongoose.model('Affectation', AffectationSchema);
