import mongoose from 'mongoose';

const VehiculeSchema = new mongoose.Schema({
  id: String,
  immatriculation: String,
  modele: String,
  marque: String,
  direction: { type: String, enum: ['RABAT_CASA','MEKNES_ERRACHIDIA','MARRAKECH_AGADIR'] },
  estDisponible: { type: Boolean, default: true },
  typeAttribution: { type: String, enum: ['INDIVIDUELLE','PARTAGEE'] },
  auditeurAttribue: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dateDebut: Date,
  dateFin: Date
});

export default mongoose.model('Vehicule', VehiculeSchema);
