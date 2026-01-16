const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

async function run() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const col = mongoose.connection.collection('affectations');

  // Set mode = 'MANUELLE' when missing, null, or using old enum values
  const oldValues = ['MANUEL','SEMI_AUTOMATISE','AUTOMATISE_IA'];

  const res = await col.updateMany(
    { $or: [ { mode: { $exists: false } }, { mode: null }, { mode: { $in: oldValues } } ] },
    { $set: { mode: 'MANUELLE' } }
  );

  console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
