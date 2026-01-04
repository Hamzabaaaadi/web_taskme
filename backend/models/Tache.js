const mongoose = require('mongoose');

const TacheSchema = new mongoose.Schema({
  id: String,
  nom: String,
  description: String,
  type: String,
  dateDebut: Date,
  dateFin: Date,
  estRemuneree: Boolean,
  specialitesConcernees: [String],
  estCommune: Boolean,
  gradesConcernes: [String],
  necessiteVehicule: Boolean,
  direction: { type: String, enum: ['RABAT_CASA','MEKNES_ERRACHIDIA','MARRAKECH_AGADIR'] },
  fichierAdministratif: String,
  nombrePlaces: Number,
  statut: { type: String, enum: ['CREEE','EN_ATTENTE_AFFECTATION','AFFECTEE','EN_COURS','TERMINEE','ANNULEE'], default: 'CREEE' },
  dateCreation: { type: Date, default: Date.now },
  affectations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Affectation' }],
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default: null }
});

module.exports = mongoose.model('Tache', TacheSchema);
