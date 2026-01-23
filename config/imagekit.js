const ImageKit = require('imagekit');
try { require('dotenv').config(); } catch (e) {}

// Support multiple env var names and derive imagekitId from URL endpoint when possible
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || process.env.IMAGEKIT_API_KEY || process.env.IMAGEKIT_PUBLIC || null;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || process.env.IMAGEKIT_API_SECRET || process.env.IMAGEKIT_PRIVATE || null;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || process.env.IMAGEKIT_URL || null;
const rawImagekitId = process.env.IMAGEKIT_IMAGEKIT_ID || null;

let client = null;
// Try to extract imagekitId from urlEndpoint if not provided
let imagekitId = rawImagekitId;
if (!imagekitId && urlEndpoint) {
  try {
    const u = new URL(urlEndpoint);
    const parts = (u.pathname || '').split('/').filter(Boolean);
    if (parts.length) imagekitId = parts[0];
  } catch (e) {}
}

// Build options with multiple naming conventions to support various SDK versions
const opts = {
  imagekitId: imagekitId || null,
  publicKey: publicKey || null,
  privateKey: privateKey || null,
  apiKey: publicKey || null,
  apiSecret: privateKey || null,
  urlEndpoint: urlEndpoint || null
};

// Validate presence of required values
const missing = [];
if (!opts.imagekitId) missing.push('imagekitId (from IMAGEKIT_IMAGEKIT_ID or IMAGEKIT_URL_ENDPOINT)');
if (!opts.apiKey && !opts.publicKey) missing.push('IMAGEKIT_PUBLIC_KEY or IMAGEKIT_API_KEY');
if (!opts.apiSecret && !opts.privateKey) missing.push('IMAGEKIT_PRIVATE_KEY or IMAGEKIT_API_SECRET');
if (!opts.urlEndpoint) missing.push('IMAGEKIT_URL_ENDPOINT');

if (missing.length === 0) {
  try {
    client = new ImageKit(opts);
    console.log('ImageKit configured (endpoint:', opts.urlEndpoint.replace(/https?:\/\//, '') + ')');
  } catch (err) {
    console.warn('ImageKit initialization failed:', (err && err.message) || err);
    client = null;
  }
} else {
  console.warn('ImageKit not configured: missing', missing.join(', '));
}

module.exports = client;
