const express = require('express');
const router = express.Router();

const affectationController = require('../controllers/affectationController');
const { basicAuth } = require('../middlewares/authMiddleware');

router.get('/me', basicAuth, affectationController.getMyAffectations);

router.get('/', affectationController.list);
router.put('/:id/accept', basicAuth, affectationController.acceptAffectation);
router.put('/:id/refuse', basicAuth, affectationController.refuseAffectation);
router.delete('/:id', affectationController.deleteAffectation);

module.exports = router;
