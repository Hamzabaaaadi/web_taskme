require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

const auditeurFields = ['specialite','grade','diplomes','formations','anciennete'];

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const db = mongoose.connection.db;
  const usersColl = db.collection('users');
  const auditeursColl = db.collection('auditeurs');

  // Find users with role AUDITEUR or with any auditeur-specific fields
  const orClauses = [{ role: 'AUDITEUR' }].concat(auditeurFields.map(f => ({ [f]: { $exists: true } })));
  const query = { $or: orClauses };

  const cursor = usersColl.find(query);
  let moved = 0;
  while (await cursor.hasNext()) {
    const user = await cursor.next();
    const auditeurDoc = { userId: user._id };
    let hasAuditeurData = false;

    auditeurFields.forEach(f => {
      if (user[f] !== undefined) {
        auditeurDoc[f] = user[f];
        hasAuditeurData = true;
      }
    });

    // If neither specific fields nor role present, skip (shouldn't happen due to query)
    // Insert or update auditeur document
    const existing = await auditeursColl.findOne({ userId: user._id });
    if (!existing) {
      try {
        await auditeursColl.insertOne(auditeurDoc);
        moved++;
        console.log('Created auditeur for user', user.email || user._id);
      } catch (err) {
        console.error('Failed to insert auditeur for', user._id, err.message);
      }
    } else {
      // Merge missing fields into existing auditeur doc
      const toSet = {};
      auditeurFields.forEach(f => {
        if (user[f] !== undefined && existing[f] === undefined) toSet[f] = user[f];
      });
      if (Object.keys(toSet).length > 0) {
        await auditeursColl.updateOne({ userId: user._id }, { $set: toSet });
        console.log('Updated auditeur for user', user.email || user._id);
      } else {
        console.log('Auditeur already exists for user', user.email || user._id);
      }
    }

    // Remove auditeur-specific fields from user document
    const unset = {};
    auditeurFields.forEach(f => { if (user[f] !== undefined) unset[f] = ""; });
    if (Object.keys(unset).length > 0) {
      await usersColl.updateOne({ _id: user._id }, { $unset: unset });
      console.log('Removed auditeur fields from user', user.email || user._id);
    }
  }

  console.log('Migration finished. Auditeurs created/updated:', moved);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
