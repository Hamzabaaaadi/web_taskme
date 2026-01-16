const mongoose = require('mongoose');

const AffectationSchema = new mongoose.Schema({
  id: String,
  tacheId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tache', required: true },
  auditeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // mode: MANUELLE | SEMIAUTO | AUTOMATIQUE_IA
  mode: { type: String, enum: ['MANUELLE','SEMIAUTO','AUTOMATIQUE_IA'], default: 'MANUELLE' },
  dateAffectation: Date,
  statut: { type: String, enum: ['EN_ATTENTE','ACCEPTEE','REFUSEE','DELEGUEE','EXPIREE'], default: 'EN_ATTENTE' },
  justificatifRefus: String,
  rapportAlgorithme: String,
  estValidee: { type: Boolean, default: true },
  dateReponse: Date,
  delaiReponse: Date,
  delegation: { type: mongoose.Schema.Types.ObjectId, ref: 'Delegation', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Affectation', AffectationSchema);
