require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const db = mongoose.connection.db;
  const coll = db.collection('auditeurs');

  const total = await coll.countDocuments();
  const withField = await coll.countDocuments({ nombre_des_taches: { $exists: true } });
  const nonNull = await coll.countDocuments({ nombre_des_taches: { $ne: null } });

  console.log('Total auditeurs:', total);
  console.log('Documents with `nombre_des_taches` field present:', withField);
  console.log('Documents with `nombre_des_taches` not null:', nonNull);

  console.log('\nSample documents WITH `nombre_des_taches` (up to 10):');
  const samplesWith = await coll.find({ nombre_des_taches: { $exists: true } }).limit(10).toArray();
  samplesWith.forEach(d => {
    console.log('- _id:', d._id.toString(), 'email/uid:', d.userId || d.email || '-', 'nombre_des_taches:', d.nombre_des_taches);
  });

  console.log('\nSample documents WITHOUT `nombre_des_taches` (up to 10):');
  const samplesWithout = await coll.find({ nombre_des_taches: { $exists: false } }).limit(10).toArray();
  samplesWithout.forEach(d => {
    console.log('- _id:', d._id.toString(), 'email/uid:', d.userId || d.email || '-');
  });

  await mongoose.disconnect();
  console.log('\nCheck complete.');
}

main().catch(err => {
  console.error('Error running check:', err);
  process.exit(1);
});
