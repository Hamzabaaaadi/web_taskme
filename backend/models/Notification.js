const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  id: String,
  destinataireId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['AFFECTATION','MODIFICATION','DELEGATION','RAPPEL','VALIDATION'] },
  titre: String,
  message: String,
  estLue: { type: Boolean, default: false },
  dateEnvoi: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
