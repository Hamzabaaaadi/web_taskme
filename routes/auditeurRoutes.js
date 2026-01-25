const express = require('express');
const router = express.Router();
const auditeurController = require('../controllers/auditeurController');

router.get('/', auditeurController.list);

// Récupérer les informations d'un auditeur par ID
router.get('/:id', auditeurController.getById);

module.exports = router;