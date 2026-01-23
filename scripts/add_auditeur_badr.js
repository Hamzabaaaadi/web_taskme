require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const usersColl = mongoose.connection.db.collection('user');
  const auditeursColl = mongoose.connection.db.collection('auditeurs');

  const email = 'badr@example.com';
  const userData = {
    nom: 'Badr',
    prenom: 'User',
    email: email,
    motDePasse: 'Badr123!',
    role: 'AUDITEUR',
    estActif: false,
    dateCreation: new Date()
  };

  try {
    const existing = await usersColl.findOne({ email });
    let userId;
    if (existing) {
      console.log('User already exists:', email);
      userId = existing._id;
    } else {
      const hashed = await bcrypt.hash(userData.motDePasse, 10);
      const toInsert = Object.assign({}, userData, { motDePasse: hashed });
      const res = await usersColl.insertOne(toInsert);
      userId = res.insertedId;
      console.log('Inserted user', email, 'id=', userId.toString());
    }

    // create or update auditeur doc
    const auditeurData = {
      userId: userId,
      specialite: 'PEDAGOGIQUE',
      grade: 'Senior',
      nombre_des_taches: 5,
      diplomes: ['Licence A'],
      formations: ['Formation X'],
      anciennete: 3
    };

    const existingAud = await auditeursColl.findOne({ userId });
    if (existingAud) {
      await auditeursColl.updateOne({ userId }, { $set: auditeurData });
      console.log('Updated auditeur document for', email);
    } else {
      const r = await auditeursColl.insertOne(auditeurData);
      console.log('Inserted auditeur document id=', r.insertedId.toString());
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Done');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
