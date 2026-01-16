const express = require('express');
const router = express.Router();

const rotationController = require('../controllers/rotationController');

router.get('/', rotationController.getRotationOrder);

module.exports = router;
