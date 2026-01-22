const fetch = require('node-fetch');
const mongoose = require('mongoose');

// Support multi-provider embeddings (openai | hf | mock)
// Env vars:
// - PROVIDER: 'openai' or 'hf' or 'mock' (optional)
// - OPENAI_API_KEY / OPENAI_EMBEDDING_MODEL
// - HF_API_KEY / HF_EMBEDDING_MODEL

// Prefer Hugging Face provider (hf). Allow override via PROVIDER env (e.g. PROVIDER=mock).
const HF_KEY = process.env.HF_API_KEY || null;
const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
const PROVIDER = (process.env.PROVIDER || 'hf').toLowerCase();
console.log(`IA service: selectedProvider=${PROVIDER} | HF_key=${HF_KEY ? 'yes' : 'no'}`);

let hfProvider = null;
if (PROVIDER === 'hf') {
  try {
    hfProvider = require('./hfEmbeddings');
  } catch (e) {
    console.warn('IA service: unable to load HuggingFace provider:', e && e.message ? e.message : e);
  }
}
let mockProvider = null;
if (PROVIDER === 'mock') {
  try {
    mockProvider = require('./mockEmbeddings');
  } catch (e) {
    console.warn('IA service: unable to load mock provider:', e && e.message ? e.message : e);
  }
}

// Generic getEmbeddings delegator — currently supports 'hf' and 'mock'.
async function getEmbeddings(inputText) {
  if (PROVIDER === 'hf') {
    if (!hfProvider || !hfProvider.getEmbeddings) throw new Error('HuggingFace provider non disponible');
    return hfProvider.getEmbeddings(inputText);
  }
  if (PROVIDER === 'mock') {
    if (!mockProvider || !mockProvider.getEmbeddings) throw new Error('Mock provider non disponible');
    return mockProvider.getEmbeddings(inputText);
  }
  throw new Error(`Provider non supporté: ${PROVIDER}`);
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

/**
 * proposerAffectationIA -- approche embeddings
 * - tache: document tâche (plain object)
 * - auditeurs: liste d'objets auditeur (préférer documents mongoose pour pouvoir mettre à jour le champ embedding)
 * Retour: { candidats, modelVersion, confidenceScore }
 */
async function proposerAffectationIA(tache, auditeurs, opts = {}) {
  // If the selected provider is hf but no HF key configured, return deterministic fallback
  if (PROVIDER === 'hf' && !HF_KEY) {
    const fallback = auditeurs.slice(0, 5).map((a, idx) => ({ auditeurId: a._id, nom: a.nom, prenom: a.prenom, score: 0.5 - idx * 0.01 }));
    return { candidats: fallback };
  }

  const taskText = `${tache.nom || ''} - ${tache.description || ''} - specialite: ${tache.specialite || ''}`;

  let taskEmb;
  try {
    const embs = await getEmbeddings(taskText);
    // Normalize embedding shapes: provider may return a single vector (array of numbers)
    // or an array-of-vectors. Handle both cases.
    if (!embs) throw new Error('Embeddings provider returned empty');
    if (Array.isArray(embs) && embs.length > 0 && typeof embs[0] === 'number') {
      // Single vector returned directly
      taskEmb = embs;
    } else if (Array.isArray(embs) && embs.length > 0 && Array.isArray(embs[0])) {
      taskEmb = embs[0];
    } else if (embs && typeof embs === 'object' && Array.isArray(embs.data)) {
      // Some providers return { data: [ ... ] }
      const d = embs.data;
      if (d.length > 0 && Array.isArray(d[0])) taskEmb = d[0];
      else if (d.length > 0 && typeof d[0] === 'number') taskEmb = d;
    } else {
      // Fallback: try to use embs as vector
      taskEmb = embs;
    }
    if (!taskEmb || !Array.isArray(taskEmb)) throw new Error('Task embedding not available or invalid shape');
  } catch (err) {
    console.error('Erreur embedding tâche:', err && err.message ? err.message : err);
    const fallback = auditeurs.slice(0, 5).map((a, idx) => ({ auditeurId: a._id, nom: a.nom, prenom: a.prenom, score: 0.45 - idx * 0.01 }));
    return { candidats: fallback };
  }

  const missing = [];
  const idxToAuditeur = [];
  for (let i = 0; i < auditeurs.length; i++) {
    const a = auditeurs[i];
    if (a.embedding && Array.isArray(a.embedding) && a.embedding.length > 0) {
      continue;
    }
    const audioText = `${a.nom || ''} ${a.prenom || ''} - specialite: ${a.specialite || ''} - formations: ${ (a.formations || []).join(',') } - historique: ${ a.historique || '' }`;
    missing.push(audioText);
    idxToAuditeur.push(a._id);
  }

  if (missing.length > 0) {
    try {
      const embResults = await getEmbeddings(missing);
      let UserModel = require('../models/User');
      // Support different export shapes (ESM named export or CommonJS)
      UserModel = UserModel && (UserModel.User || UserModel.default || UserModel);
      // Normalize embResults: could be single vector or array-of-vectors
      let normalized = embResults;
      if (Array.isArray(embResults) && embResults.length > 0 && typeof embResults[0] === 'number') {
        // Single vector returned for single input
        normalized = [embResults];
      }
      const promises = normalized.map((emb, k) => {
        const id = idxToAuditeur[k];
        return UserModel.updateOne({ _id: id }, { $set: { embedding: emb } }).catch(() => null);
      });
      await Promise.all(promises);
      for (let k = 0; k < idxToAuditeur.length; k++) {
        const id = idxToAuditeur[k].toString();
        const emb = normalized[k];
        for (const a of auditeurs) {
          if (a._id && a._id.toString && a._id.toString() === id) {
            a.embedding = emb;
            break;
          }
        }
      }
    } catch (err) {
      console.warn('Erreur en récupérant/storant embeddings auditeurs:', err && err.message ? err.message : err);
    }
  }

  const candidats = [];
  for (const a of auditeurs) {
    const emb = a.embedding;
    if (!emb || !Array.isArray(emb)) {
      candidats.push({ auditeurId: a._id, nom: a.nom, prenom: a.prenom, score: 0.0 });
      continue;
    }
    // If embedding lengths differ, use min length for similarity to avoid NaN
    if (!Array.isArray(taskEmb)) {
      console.warn('IA service: taskEmb is not an array, unexpected shape', typeof taskEmb);
    }
    let score;
    try {
      if (taskEmb.length !== emb.length) {
        const minLen = Math.min(taskEmb.length, emb.length);
        score = cosineSimilarity(taskEmb.slice(0, minLen), emb.slice(0, minLen));
      } else {
        score = cosineSimilarity(taskEmb, emb);
      }
    } catch (e) {
      console.error('IA service: cosine similarity error', e && e.message ? e.message : e);
      score = 0;
    }
    const raisons = [];
    // Speciality match: case-insensitive partial match
    try {
      const aSpec = a.specialite ? a.specialite.toString().toLowerCase() : '';
      const tSpec = tache.specialite ? tache.specialite.toString().toLowerCase() : '';
      if (aSpec && tSpec && aSpec.includes(tSpec)) {
        raisons.push('Spécialité correspondante');
      }
    } catch (e) {
      // ignore introspection errors
    }

    // Semantic match reasons with more granular thresholds
    if (score > 0.9) raisons.push('Très bon match sémantique');
    else if (score > 0.75) raisons.push('Bon match sémantique');
    else if (score > 0.5) raisons.push('Match sémantique modéré');

    // Always include a human-readable similarity indicator (rounded) so UI can show why
    try {
      const rounded = (typeof score === 'number') ? score.toFixed(3) : score;
      raisons.push(`Similarité sémantique: ${rounded}`);
    } catch (e) {
      // ignore
    }

    candidats.push({ auditeurId: a._id, nom: a.nom, prenom: a.prenom, score });
  }

  candidats.sort((x, y) => y.score - x.score);
  // Determine number of requested places on the task. Support a few common field names.
  const requestedPlaces = (tache && (tache.nombrePlaces || tache.nombre_places || tache.nombre_place || tache.nombre_des_places)) || 20;
  const maxCandidates = Math.max(0, parseInt(requestedPlaces, 10) || 20);
  const selected = candidats.slice(0, maxCandidates);
  // Do not pad with placeholder auditors when there are fewer actual candidates than requested.
  return { candidats: selected };
}

module.exports = { proposerAffectationIA };
