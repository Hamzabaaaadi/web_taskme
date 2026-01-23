// Simple test for ImageKit initialization and upload
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const imagekit = require('../config/imagekit');
    if (!imagekit) {
      console.error('ImageKit client not configured (config returned null).');
      process.exit(2);
    }
    console.log('ImageKit client loaded.');

    // Try uploadViaURL (server-side) to validate API access
    try {
      const viaUrlResp = await imagekit.uploadViaURL({ url: 'https://httpbin.org/image/png', fileName: 'test_via_url.png', folder: 'test-uploads' });
      console.log('uploadViaURL response:', viaUrlResp && viaUrlResp.url ? viaUrlResp.url : JSON.stringify(viaUrlResp));
    } catch (e) {
      console.warn('uploadViaURL failed:', e && (e.message || e));
      try { console.warn('Details:', JSON.stringify(e)); } catch (err) {}
    }

    // Try a local file if present
    const filePath = process.argv[2] || path.join(process.env.USERPROFILE || '.', 'Pictures', 'python-essentials-1.1 (1).png');
    if (!fs.existsSync(filePath)) {
      console.warn('Local test file not found:', filePath, '- skipping binary upload test');
      process.exit(0);
    }

    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const fileName = 'test_upload_' + Date.now() + '_' + path.basename(filePath).replace(/[^a-z0-9._-]/gi, '_');

    try {
      const resp = await imagekit.upload({ file: buffer, fileName, folder: 'test-uploads' });
      console.log('Binary upload success:', resp && resp.url ? resp.url : JSON.stringify(resp));
    } catch (err) {
      console.error('Binary upload failed:', err && (err.message || err));
      try { console.error('Details:', JSON.stringify(err)); } catch (e) {}
    }

  } catch (err) {
    console.error('Test script error:', err && (err.message || err));
    process.exit(1);
  }
}

main();
