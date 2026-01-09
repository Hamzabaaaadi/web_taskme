const express = require('express');
const router = express.Router();
const auditeurController = require('../controllers/auditeurController');

router.get('/', auditeurController.list);

module.exports = router;