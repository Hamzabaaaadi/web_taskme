require('dotenv').config();
const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function main() {
  const uri = process.argv[2] || 'http://localhost:5000/api/users/695fb9ebbaa3e5aabc314152/avatar';
  const filePath = process.argv[3] || (require('path').join(process.env.USERPROFILE || '.', 'Pictures', 'python-essentials-1.1 (1).png'));
  const email = process.argv[4] || 'cordinateur@example.com';
  const password = process.argv[5] || 'cordinateur123';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(2);
  }
  const form = new FormData();
  form.append('avatar', fs.createReadStream(filePath));
  const auth = 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
  try {
    const res = await fetch(uri, { method: 'PUT', headers: Object.assign({ Authorization: auth }, form.getHeaders()), body: form });
    const text = await res.text();
    console.log('STATUS', res.status);
    try { console.log('BODY', JSON.parse(text)); } catch (e) { console.log('BODY', text); }
  } catch (e) {
    console.error('Request error', e && e.message);
  }
}

main();
