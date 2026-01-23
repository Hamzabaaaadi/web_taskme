require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const usersColl = mongoose.connection.db.collection('user');
  const auditeursColl = mongoose.connection.db.collection('auditeurs');

  // Replace these values as needed
  const userData = {
    nom: 'Dupont',
    prenom: 'Pierre',
    email: 'p.dupont@example.com',
    motDePasse: 'AuditeurPass1!',
    role: 'AUDITEUR',
    estActif: false,
    dateCreation: new Date()
  };

  // Auditeur-specific fields
  const auditeurData = {
    specialite: 'PEDAGOGIQUE',
    grade: 'Senior',
    diplomes: ['Master en Audit', 'Certificat X'],
    formations: ['Formation A', 'Formation B'],
    anciennete: 5
  };

  // Check existing user by email
  const existing = await usersColl.findOne({ email: userData.email });
  let userId;
  if (existing) {
    console.log('User already exists:', userData.email);
    userId = existing._id;
  } else {
    const hashed = await bcrypt.hash(userData.motDePasse, 10);
    const toInsert = Object.assign({}, userData, { motDePasse: hashed });
    const res = await usersColl.insertOne(toInsert);
    userId = res.insertedId;
    console.log('Inserted user', userData.email, 'id=', userId.toString());
  }

  // Create auditeur doc linked to userId
  const existingAud = await auditeursColl.findOne({ userId: userId });
  if (existingAud) {
    console.log('Auditeur document already exists for user', userData.email);
  } else {
    const audDoc = Object.assign({ userId: userId }, auditeurData);
    const r2 = await auditeursColl.insertOne(audDoc);
    console.log('Created auditeur document id=', r2.insertedId.toString());
  }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
