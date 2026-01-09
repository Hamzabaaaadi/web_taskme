const express = require('express');
const router = express.Router();
const vehiculeController = require('../controllers/vehiculeController');

router.get('/', vehiculeController.list);
router.post('/', vehiculeController.create);
router.put('/:id', vehiculeController.update);
router.delete('/:id', vehiculeController.delete);

module.exports = router;
