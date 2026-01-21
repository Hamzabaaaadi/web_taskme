const express = require('express');
const router = express.Router();

const delegationController = require('../controllers/delegationController');
const { basicAuth } = require('../middlewares/authMiddleware');

router.post('/create',basicAuth, delegationController.createDelegation);

router.get('/me', basicAuth, delegationController.getMyDelegations);
router.get('/me/propres', basicAuth, delegationController.getMyProposedDelegations);
router.put('/:id/modifier', basicAuth, delegationController.updateDelegation);
router.delete('/:id/supprimer', basicAuth, delegationController.deleteDelegation);
router.put('/:id/accepter', basicAuth, delegationController.accepterDelegation);
router.put('/:id/refuser', basicAuth, delegationController.refuserDelegation);

module.exports = router;
