const mongoose = require('mongoose');

const HistoriqueSchema = new mongoose.Schema({
  id: String,
  utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tacheId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tache' },
  action: { type: String, enum: ['CREATION_TACHE','AFFECTATION','ACCEPTATION','REFUS','DELEGATION','MODIFICATION','VALIDATION'] },
  dateAction: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Historique', HistoriqueSchema);
