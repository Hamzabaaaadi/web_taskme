require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wwwdb';

function pluralize(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('y')) return lower.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(lower)) return lower + 'es';
  return lower + 's';
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', MONGODB_URI);

  const modelsDir = path.join(__dirname, '..', 'models');
  let files = [];
  try {
    files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
  } catch (err) {
    console.error('Cannot read models directory:', modelsDir, err.message);
    process.exit(1);
  }

  const collections = [];

  for (const file of files) {
    const filePath = path.join(modelsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Try to extract explicit collection name from schema options
    const collMatch = content.match(/collection\s*:\s*['"`](.*?)['"`]/);
    if (collMatch && collMatch[1]) {
      collections.push({ from: file, name: collMatch[1] });
      continue;
    }

    // Fallback: try to extract model name from mongoose.model('Name', ...)
    const modelMatch = content.match(/mongoose\.model\s*\(\s*['"`](\w+)['"`]/);
    if (modelMatch && modelMatch[1]) {
      const inferred = pluralize(modelMatch[1]);
      collections.push({ from: file, name: inferred });
      continue;
    }

    console.warn('Could not determine collection name for', file, '- skipping');
  }

  // Create collections
  for (const c of collections) {
    try {
      const exists = await mongoose.connection.db.listCollections({ name: c.name }).toArray();
      if (exists.length === 0) {
        await mongoose.connection.createCollection(c.name);
        console.log('Created collection', c.name, '(from', c.from + ')');
      } else {
        console.log('Collection already exists:', c.name);
      }
    } catch (err) {
      console.error('Error creating collection', c.name, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
