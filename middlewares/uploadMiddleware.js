const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Keep uploads directory for fallback (local storage)
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Use memory storage so controller can upload buffer directly to ImageKit
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = { upload };
