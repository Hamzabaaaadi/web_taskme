import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  id: String,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tacheId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tache' },
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  dateCreation: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Chat', ChatSchema);
