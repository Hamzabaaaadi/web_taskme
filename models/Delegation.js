const mongoose = require('mongoose');

const DelegationSchema = new mongoose.Schema({
  id: String,
  affectationOriginale: { type: mongoose.Schema.Types.ObjectId, ref: 'Affectation', required: true },
  auditeurInitial: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auditeurPropose: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  justification: String,
  statut: { type: String, enum: ['EN_ATTENTE','ACCEPTEE','REFUSEE'], default: 'EN_ATTENTE' },
  dateProposition: { type: Date, default: Date.now },
  dateReponse: Date
}, { timestamps: true });

module.exports = mongoose.model('Delegation', DelegationSchema);
