const Tache = require('../models/Tache');
let Auditeur;
try {
  Auditeur = require('../models/Auditeur');
  Auditeur = Auditeur.Auditeur || Auditeur.default || Auditeur;
} catch (e) { Auditeur = null; }
let User;
try {
  User = require('../models/User');
  User = User.User || User.default || User;
} catch (e) { User = null; }

exports.searchTasks = async (req, res) => {
  const q = req.query.q || '';
  const filter = q ? { $or: [ { nom: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } } ] } : {};
  const taches = await Tache.find(filter).lean();
  res.json({ taches });
};

exports.searchAuditeurs = async (req, res) => {
  const q = req.query.q || '';
  let auditeurs = [];
  if (Auditeur && typeof Auditeur.find === 'function') {
    const filter = q ? { $or: [ { specialite: { $regex: q, $options: 'i' } }, { grade: { $regex: q, $options: 'i' } } ] } : {};
    auditeurs = await Auditeur.find(filter).lean();
  }
  res.json({ auditeurs });
};

exports.searchUsers = async (req, res) => {
  const q = req.query.q || '';
  let users = [];
  if (User && typeof User.find === 'function') {
    const filter = q ? { $or: [ { nom: { $regex: q, $options: 'i' } }, { prenom: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } } ] } : {};
    users = await User.find(filter).lean();
  }
  res.json({ users });
};