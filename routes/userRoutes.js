const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { basicAuth } = require('../middlewares/authMiddleware');
const { updateProfileValidator, updateUserValidator } = require('../validators/userValidator');

router.get('/me', basicAuth, userController.me);
router.put('/me', basicAuth, updateProfileValidator, userController.update);
router.get('/:id', basicAuth, userController.getById);
router.put('/:id', basicAuth, updateUserValidator, userController.updateUser);
router.delete('/:id', basicAuth, userController.deleteUser);

module.exports = router;
