require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

const users = [
  // 3 auditeurs
  {
    nom: 'Martin',
    prenom: 'Alain',
    email: 'a.martin@example.com',
    motDePasse: 'Aud1teur!',
    role: 'AUDITEUR',
    auditeur: {
      specialite: 'ORIENTATION',
      grade: 'Junior',
      diplomes: ['Licence X'],
      formations: ['Formation 1'],
      anciennete: 2
    }
  },
  {
    nom: 'Bernard',
    prenom: 'Sophie',
    email: 's.bernard@example.com',
    motDePasse: 'Aud2teur!',
    role: 'AUDITEUR',
    auditeur: {
      specialite: 'PEDAGOGIQUE',
      grade: 'Senior',
      diplomes: ['Master Y'],
      formations: ['Formation A','Formation B'],
      anciennete: 6
    }
  },
  {
    nom: 'Nguyen',
    prenom: 'Linh',
    email: 'l.nguyen@example.com',
    motDePasse: 'Aud3teur!',
    role: 'AUDITEUR',
    auditeur: {
      specialite: 'PLANIFICATION',
      grade: 'Intermediate',
      diplomes: ['Diplome Z'],
      formations: ['Formation C'],
      anciennete: 4
    }
  },

  // 2 coordinateurs
  {
    nom: 'Klein',
    prenom: 'Marie',
    email: 'm.klein@example.com',
    motDePasse: 'Coord1!',
    role: 'COORDINATEUR'
  },
  {
    nom: 'Rossi',
    prenom: 'Marco',
    email: 'm.rossi@example.com',
    motDePasse: 'Coord2!',
    role: 'COORDINATEUR'
  }
];

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const usersColl = mongoose.connection.db.collection('user');
  const auditeursColl = mongoose.connection.db.collection('auditeurs');

  for (const u of users) {
    try {
      const exists = await usersColl.findOne({ email: u.email });
      if (exists) {
        console.log('Skipping existing user:', u.email);
        // If user exists and is AUDITEUR, ensure auditeur doc exists/updated
        if (u.role === 'AUDITEUR') {
          const userId = exists._id;
          const existingAud = await auditeursColl.findOne({ userId });
          if (!existingAud) {
            const audDoc = Object.assign({ userId }, u.auditeur || {});
            await auditeursColl.insertOne(audDoc);
            console.log('Created auditeur doc for existing user', u.email);
          }
        }
        continue;
      }

      const hashed = await bcrypt.hash(u.motDePasse, 10);
      const userDoc = {
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        motDePasse: hashed,
        role: u.role,
        estActif: false,
        dateCreation: new Date()
      };

      const res = await usersColl.insertOne(userDoc);
      console.log('Inserted user', u.email, 'id=', res.insertedId.toString());

      if (u.role === 'AUDITEUR' && u.auditeur) {
        const audDoc = Object.assign({ userId: res.insertedId }, u.auditeur);
        await auditeursColl.insertOne(audDoc);
        console.log('Inserted auditeur doc for', u.email);
      }
    } catch (err) {
      console.error('Error creating user', u.email, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
