const fetch = require('node-fetch');

const HF_API_KEY = process.env.HF_API_KEY || null;
const HF_MODEL = process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';

console.log(`IA service: HuggingFace configured: ${HF_API_KEY ? 'yes' : 'no'}`);

// Try to load the official SDK if available; it handles routing and formats.
let hfSdk = null;
try {
  const { HfInference } = require('@huggingface/inference');
  // The constructor expects the access token string as the first argument.
  hfSdk = new HfInference(HF_API_KEY);
  console.log('IA service: using @huggingface/inference SDK for embeddings');
  try {
    const proto = Object.getPrototypeOf(hfSdk);
    const protoMethods = Object.getOwnPropertyNames(proto).filter(n => typeof hfSdk[n] === 'function');
    console.log('IA service: hfSdk proto methods:', protoMethods.slice(0, 50));
    console.log('IA service: hfSdk.embeddings type=', typeof hfSdk.embeddings, ' hfSdk.featureExtraction type=', typeof hfSdk.featureExtraction);
  } catch (e) {
    console.log('IA service: could not introspect hfSdk methods', e && e.message ? e.message : e);
  }
} catch (e) {
  hfSdk = null;
  console.log('IA service: @huggingface/inference SDK not installed, falling back to HTTP fetch');
}

// Returns an array of embeddings (one per input). Accepts a string or array of strings.
async function getEmbeddingsHF(inputText) {
  if (!HF_API_KEY) throw new Error('HF_API_KEY non configurée');

  const inputs = Array.isArray(inputText) ? inputText : [inputText];

  // Hugging Face endpoints: try several path variations to handle router vs legacy
  // Prefer the router domain but also try /models/{model} and /pipeline/feature-extraction/{model}
  // Encode each path segment but keep '/' between segments so router path matches
  const encodedModel = HF_MODEL.split('/').map(s => encodeURIComponent(s)).join('/');
  // If the official SDK is available, try it first (it handles router vs legacy endpoints).
  if (hfSdk) {
    try {
      // The SDK exposes task methods (see tasks list). Many versions don't have `embeddings` method;
      // use a best-effort list of method names and call the first available one.
      const candidateMethods = ['embeddings', 'featureExtraction', 'feature_extraction', 'sentenceSimilarity', 'sentence_similarity'];
      let sdkRes;
      for (const m of candidateMethods) {
        if (typeof hfSdk[m] === 'function') {
          console.log(`IA service: calling hfSdk.${m}()`);
          // featureExtraction expects { model, inputs }
          if (m === 'featureExtraction' || m === 'feature_extraction') {
            sdkRes = await hfSdk.featureExtraction({ model: HF_MODEL, inputs: inputs.length === 1 ? inputs[0] : inputs });
          } else {
            // generic call shape: pass model and input(s)
            sdkRes = await hfSdk[m]({ model: HF_MODEL, input: inputs.length === 1 ? inputs[0] : inputs });
          }
          break;
        }
      }
      // Normalize SDK response shapes
      if (Array.isArray(sdkRes)) return sdkRes;
      if (sdkRes && Array.isArray(sdkRes.embeddings)) return sdkRes.embeddings;
      if (sdkRes && Array.isArray(sdkRes.data)) return sdkRes.data;
      // featureExtraction sometimes returns nested arrays/objects
      if (sdkRes && sdkRes?.[0] && Array.isArray(sdkRes[0])) return sdkRes;
      if (sdkRes && typeof sdkRes === 'object') {
        // try to extract first embedding if present
        if (Array.isArray(sdkRes[0]?.data)) return sdkRes.map(r => r.data[0]);
      }
    } catch (sdkErr) {
      console.error('IA service: HuggingFace SDK embeddings error', sdkErr && sdkErr.message ? sdkErr.message : sdkErr);
      // fallthrough to HTTP fallback
    }
  }
  // Try embeddings-specific endpoints first (newer HF API), then model/pipeline paths
  const endpoints = [
    `https://router.huggingface.co/embeddings`,
    `https://api-inference.huggingface.co/embeddings`,
    `https://router.huggingface.co/models/${encodedModel}`,
    `https://router.huggingface.co/pipeline/feature-extraction/${encodedModel}`,
    `https://api-inference.huggingface.co/models/${encodedModel}`,
    `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodedModel}`
  ];

  try {
    // Try endpoints in order (router first). For batch request, send array of inputs.
    let lastErr;
    for (const url of endpoints) {
      try {
        console.log(`IA service: trying HF endpoint ${url}`);
        // Build body payload depending on endpoint type
        let bodyPayload;
        if (url.endsWith('/embeddings')) {
          // embeddings endpoint expects { model: 'owner/model', input: ... }
          bodyPayload = { model: HF_MODEL, input: inputs.length === 1 ? inputs[0] : inputs };
        } else if (url.includes('/models/')) {
          // For /models endpoints, many accept single input string or array
          bodyPayload = inputs.length === 1 ? inputs[0] : inputs;
        } else {
          // pipeline endpoints expect { inputs: ... }
          bodyPayload = { inputs };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!res.ok) {
          let txt = '';
          try { txt = await res.text(); } catch (e) { txt = '<could not read response text>'; }
          console.error(`IA service: HuggingFace embeddings error status=${res.status} body=${txt}`);
          // If 410 (gone) try next endpoint, otherwise throw
          if (res.status === 410) {
            lastErr = new Error(`HuggingFace embeddings 410: ${txt}`);
            continue;
          }
          throw new Error(`HuggingFace embeddings error ${res.status} - ${txt}`);
        }

        const text = await res.text();
        console.log(`IA service: HF endpoint ${url} returned status ${res.status} body=${text}`);
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }
        // If we get here, success — parse and return in flexible ways
        // Common shapes:
        // - Array of vectors: [ [..], [..], ... ]
        // - Array of objects with vectors inside
        // - Single vector
        if (Array.isArray(data)) {
          // If it's array of arrays -> batch embeddings
          if (data.length > 0 && Array.isArray(data[0])) {
            return data.map(d => d);
          }
          // If it's array of objects and each has 'embedding' or 'data'
          if (data.length > 0 && typeof data[0] === 'object') {
            // try to extract embedding field
            return data.map(item => item.embedding || (item.data && item.data[0]) || item);
          }
          return data;
        }
        // If response is an object, try common patterns
        if (data && typeof data === 'object') {
          // Hugging Face router might return { "error": ... }
          if (data.error) throw new Error(JSON.stringify(data));
          // Some endpoints return { "0": [..], ... } or { "data": [...] }
          if (Array.isArray(data.data)) {
            return data.data.map(d => Array.isArray(d) ? d : (d.embedding || d));
          }
          // If single embedding present
          if (Array.isArray(data.embedding)) return [data.embedding];
          // Last resort: return as-is
          return data;
        }
      } catch (innerErr) {
        // try next endpoint if available
        lastErr = innerErr;
        continue;
      }
    }
    // If we exhausted endpoints, throw last error
    throw lastErr || new Error('HuggingFace embeddings request failed');
  } catch (err) {
    // generic catch — preserve message for caller
    console.error('IA service: HuggingFace embeddings error', err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = { getEmbeddings: getEmbeddingsHF };
