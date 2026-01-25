import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema({
  auditorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  score: Number
}, { _id: false });

const ExclSchema = new mongoose.Schema({
  auditorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reasons: [String]
}, { _id: false });

const AssignmentProposalSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tache', required: true },
  candidats: [CandidateSchema],
  exclus: [ExclSchema],
  status: { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  decidedAt: Date,
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decisionComment: String
});

export default mongoose.model('AssignmentProposal', AssignmentProposalSchema);
