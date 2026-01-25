const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginValidator, registerValidator } = require('../validators/userValidator');

router.post('/login', loginValidator, authController.login);
router.post('/register', registerValidator, authController.register);
router.post('/logout', authController.logout);

module.exports = router;
