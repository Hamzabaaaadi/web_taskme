const express = require('express');
const router = express.Router();
const tacheController = require('../controllers/tacheController');
const { upload } = require('../middlewares/uploadMiddleware');

router.get('/', tacheController.list);
router.get('/:id', tacheController.detail);
router.post('/', tacheController.create);
router.put('/:id', tacheController.update);
router.delete('/:id', tacheController.delete);
router.post('/:id/file', upload.single('file'), tacheController.uploadFile);

router.post('/:id/assign', tacheController.assign);
router.post('/:id/assign/validate', tacheController.validateAssign);
router.post('/:id/assign/reject', tacheController.rejectAssign);
router.post('/affectation/:affectationId/validate', tacheController.validateAssign);
router.post('/affectation/:affectationId/reject', tacheController.rejectAssign);
router.post('/:id/assign/delegé', tacheController.delegateAssign);
 // Marquer une tâche comme terminée
router.post('/:id/complete', tacheController.complete)
module.exports = router;