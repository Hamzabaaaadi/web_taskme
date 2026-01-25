const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');


router.get('/', basicAuth, notificationController.listForUser);
router.put('/:id/read', basicAuth, notificationController.markRead);
router.post('/', basicAuth, notificationController.create);

module.exports = router;
