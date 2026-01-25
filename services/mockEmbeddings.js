// Mock embeddings provider for local testing.
// Returns a deterministic pseudo-embedding (vector of floats) per input string.
const crypto = require('crypto');

function textToVector(text, dim = 1536) {
  // Simple deterministic hash -> float vector (not real semantic embeddings)
  const hash = crypto.createHash('sha256').update(text || '').digest();
  const vec = new Array(dim);
  // Expand hash bytes to floats by repeated hashing if needed
  let seed = Buffer.from(hash);
  for (let i = 0; i < dim; i++) {
    const idx = i % seed.length;
    vec[i] = (seed[idx] / 255.0) * 2 - 1; // map to [-1,1]
    if (i % seed.length === seed.length - 1) {
      // rehash to vary bytes
      seed = crypto.createHash('sha256').update(seed).digest();
    }
  }
  return vec;
}

async function getEmbeddingsMock(inputText) {
  const inputs = Array.isArray(inputText) ? inputText : [inputText];
  return inputs.map(t => textToVector(t, 512));
}

module.exports = { getEmbeddings: getEmbeddingsMock };
