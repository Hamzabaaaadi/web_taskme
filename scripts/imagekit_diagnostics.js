// Diagnostic script: try multiple upload methods against ImageKit using .env keys
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function trySdkUploads(imagekit, buffer) {
  console.log('\n== SDK: uploadViaURL ==');
  try {
    const via = await imagekit.uploadViaURL({ url: 'https://httpbin.org/image/png', fileName: 'diag_via_url.png', folder: 'diag' });
    console.log('uploadViaURL OK:', via && via.url ? via.url : JSON.stringify(via));
  } catch (e) {
    console.error('uploadViaURL ERR:', e && (e.message || e));
    try { console.error('details:', JSON.stringify(e)); } catch(_){}
  }

  console.log('\n== SDK: upload buffer ==');
  try {
    const up = await imagekit.upload({ file: buffer, fileName: 'diag_buffer.png', folder: 'diag' });
    console.log('upload buffer OK:', up && up.url ? up.url : JSON.stringify(up));
  } catch (e) {
    console.error('upload buffer ERR:', e && (e.message || e));
    try { console.error('details:', JSON.stringify(e)); } catch(_){}
  }

  console.log('\n== SDK: upload base64 ==');
  try {
    const base64 = buffer.toString('base64');
    const up2 = await imagekit.upload({ file: base64, fileName: 'diag_base64.png', folder: 'diag' });
    console.log('upload base64 OK:', up2 && up2.url ? up2.url : JSON.stringify(up2));
  } catch (e) {
    console.error('upload base64 ERR:', e && (e.message || e));
    try { console.error('details:', JSON.stringify(e)); } catch(_){}
  }
}

async function tryRestUpload(publicKey, privateKey, buffer, methodDesc) {
  const uploadEndpoint = 'https://upload.imagekit.io/api/v1/files/upload';
  console.log(`\n== REST ${methodDesc} POST to ${uploadEndpoint} ==`);
  const form = new FormData();
  form.append('file', buffer, { filename: 'diag_rest.png', contentType: 'image/png' });
  form.append('fileName', 'diag_rest.png');
  form.append('folder', 'diag');

  let authHeader;
  if (methodDesc === 'public:private') {
    authHeader = 'Basic ' + Buffer.from(`${publicKey}:${privateKey}`).toString('base64');
  } else if (methodDesc === 'private:empty') {
    authHeader = 'Basic ' + Buffer.from(`${privateKey}:`).toString('base64');
  } else if (methodDesc === 'noauth') {
    authHeader = null;
  }

  try {
    const headers = form.getHeaders();
    if (authHeader) headers.Authorization = authHeader;
    const res = await fetch(uploadEndpoint, { method: 'POST', headers, body: form, timeout: 20000 });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch (_) {}
    console.log('STATUS', res.status, 'BODY', parsed);
  } catch (e) {
    console.error('REST upload ERR:', e && (e.message || e));
  }
}

async function main() {
  console.log('ImageKit diagnostics starting...');
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || '';
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || '';
  console.log('ENV preview -> public:', !!publicKey, 'private:', !!privateKey, 'urlEndpoint:', !!urlEndpoint);

  // read a local image if exists
  const testPath = path.join(process.env.USERPROFILE || '.', 'Pictures', 'python-essentials-1.1 (1).png');
  let buffer = null;
  if (fs.existsSync(testPath)) {
    buffer = fs.readFileSync(testPath);
    console.log('Loaded local test image:', testPath, 'size:', buffer.length);
  } else {
    console.log('No local test image found at', testPath, '- will use httpbin via SDK uploadViaURL only.');
    buffer = Buffer.from('');
  }

  // Try SDK if available
  try {
    const ImageKit = require('imagekit');
    const imagekit = new ImageKit({
      publicKey: publicKey || undefined,
      privateKey: privateKey || undefined,
      urlEndpoint: urlEndpoint || undefined
    });
    console.log('ImageKit SDK initialized.');
    await trySdkUploads(imagekit, buffer);
  } catch (e) {
    console.warn('ImageKit SDK not available or init failed:', e && (e.message || e));
  }

  // Try REST POST variants
  await tryRestUpload(publicKey, privateKey, buffer, 'public:private');
  await tryRestUpload(publicKey, privateKey, buffer, 'private:empty');
  await tryRestUpload(publicKey, privateKey, buffer, 'noauth');

  console.log('\nDiagnostics complete.');
}

main().catch(e => { console.error('Fatal:', e && e.message); process.exit(1); });
