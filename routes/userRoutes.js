const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { basicAuth } = require('../middlewares/authMiddleware');
const { updateProfileValidator, updateUserValidator } = require('../validators/userValidator');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', userController.list);

router.get('/me', basicAuth, userController.me);
router.put('/me', basicAuth, updateProfileValidator, userController.update);
router.get('/all', userController.listAll);
router.get('/auditeurs', basicAuth, userController.listAuditeurs);
router.get('/:id', basicAuth, userController.getById);
router.put('/:id', basicAuth, updateUserValidator, userController.updateUser);
router.delete('/:id', basicAuth, userController.deleteUser);
router.put('/:id/avatar', basicAuth, upload.single('avatar'), userController.uploadAvatar);

module.exports = router;
