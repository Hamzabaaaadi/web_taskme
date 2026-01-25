const mongoose = require('mongoose');
const path = require('path');

async function main() {
  // Load project env if present
  try {
    require('dotenv').config();
  } catch (e) {}

  // Attempt to use existing db config if available
  let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    try {
      const env = require('../config/env');
      mongoUri = env.MONGO_URI || env.MONGODB_URI || env.MONGO_URL || env.DB_URI;
    } catch (e) {}
  }

  if (!mongoUri) {
    // fallback to same default used by server.js
    mongoUri = 'mongodb://localhost:27017/wwwdb';
    console.warn('MONGO_URI not found in env; falling back to', mongoUri);
  }

  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const Affectation = require('../models/Affectation');
  const User = require('../models/User');
  const Auditeur = (() => {
    try { return require('../models/Auditeur'); } catch (e) { return null; }
  })();

  const ModelA = Affectation && (Affectation.Affectation || Affectation.default || Affectation);
  const ModelU = User && (User.User || User.default || User);
  const ModelAud = Auditeur && (Auditeur.Auditeur || Auditeur.default || Auditeur);

  const semiautos = await ModelA.find({ mode: 'SEMIAUTO' }).lean();
  console.log('Found', semiautos.length, 'SEMIAUTO affectations');

  const ids = new Set();
  for (const s of semiautos) {
    if (s.auditeurId) ids.add(String(s.auditeurId));
  }

  const idList = Array.from(ids).filter(Boolean);
  console.log('Unique auditeurIds count:', idList.length);

  const users = await ModelU.find({ _id: { $in: idList } }).lean();
  const foundUserIds = new Set(users.map(u => String(u._id)));

  const missing = idList.filter(id => !foundUserIds.has(id));

  console.log('Users found:', users.length);
  if (users.length > 0) console.log('Sample user:', { _id: users[0]._id, nom: users[0].nom, prenom: users[0].prenom });

  if (missing.length) {
    console.log('Missing user ids (no User doc):', missing.length);
    console.log(missing.join('\n'));
    if (ModelAud) {
      const auds = await ModelAud.find({ _id: { $in: missing } }).lean();
      if (auds && auds.length) {
        console.log('Found correspondings in Auditeur collection:', auds.length);
        for (const a of auds) console.log(String(a._id), '-', a.nom || a.name || a.prenom || 'no-name');
      }
    }
  } else {
    console.log('All auditeurIds correspond to User documents.');
  }

  // For each semiauto affectation, print brief info
  console.log('\nListing SEMIAUTO affectations with auditeurId and whether user exists:');
  for (const s of semiautos) {
    const aid = s.auditeurId ? String(s.auditeurId) : null;
    const exists = aid ? foundUserIds.has(aid) : false;
    console.log(String(s._id), 'tache:', s.tacheId ? String(s.tacheId) : null, 'auditeurId:', aid, 'userExists:', exists);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Error during diagnostics:', err && err.stack ? err.stack : err);
  process.exit(2);
});
