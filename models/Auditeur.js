const mongoose = require('mongoose');

const auditeurSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    specialite: { type: String, enum: ['PEDAGOGIQUE','ORIENTATION','PLANIFICATION','SERVICES_FINANCIERS'] },
    grade: { type: String },
    nombre_des_taches: { type: Number, min: 0 },
    diplomes: [{ type: String }],
    formations: [{ type: String }],
    anciennete: { type: Number, min: 0 }
  },
  { collection: 'auditeurs' }
);

module.exports = mongoose.model('Auditeur', auditeurSchema);