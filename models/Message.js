const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  id: String,
  expediteurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contenu: String,
  dateEnvoi: { type: Date, default: Date.now },
  estLu: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
