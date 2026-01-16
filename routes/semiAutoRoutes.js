const express = require('express');
const router = express.Router();
const semiautoController = require('../controllers/semiAutoController');

// GET /api/semiauto/propose/:taskId
router.get('/propose/:taskId', semiautoController.propose);

// Legacy semi-auto route: disabled. Use /api/semiauto instead.
router.post('/:taskId', (req, res) => res.status(410).json({ error: 'Legacy semi-auto route removed. Use /api/semiauto/propose/:taskId' }));

module.exports = router;
