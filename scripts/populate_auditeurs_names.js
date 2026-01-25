const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const audCol = mongoose.connection.collection('auditeurs');
  const userCol = mongoose.connection.collection('users');

  const auds = await audCol.find({ userId: { $exists: true } }).toArray();
  console.log('Found', auds.length, 'auditeurs with userId');

  let updated = 0;
  for (const a of auds) {
    try {
      const uid = a.userId;
      if (!uid) continue;
      const user = await userCol.findOne({ _id: typeof uid === 'string' ? new mongoose.Types.ObjectId(uid) : uid });
      if (!user) continue;
      const setObj = {};
      if (user.nom) setObj.nom = user.nom;
      if (user.prenom) setObj.prenom = user.prenom;
      if (Object.keys(setObj).length) {
        await audCol.updateOne({ _id: a._id }, { $set: setObj });
        updated++;
      }
    } catch (e) {
      console.warn('Error updating auditeur', a._id, e && e.message ? e.message : e);
    }
  }

  console.log('Updated', updated, 'auditeurs with names');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(2); });
