const express = require('express');
const router = express.Router();

const delegationController = require('../controllers/delegationController');
const { basicAuth } = require('../middlewares/authMiddleware');

router.get('/me', basicAuth, delegationController.getMyDelegations);
router.put('/:id/accepter', basicAuth, delegationController.accepterDelegation);
router.put('/:id/refuser', basicAuth, delegationController.refuserDelegation);

module.exports = router;
