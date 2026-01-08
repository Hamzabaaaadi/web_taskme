const express = require('express');
const router = express.Router();

const affectationController = require('../controllers/affectationController');
const { basicAuth } = require('../middlewares/authMiddleware');

router.get('/me', basicAuth, affectationController.getMyAffectations);

module.exports = router;
