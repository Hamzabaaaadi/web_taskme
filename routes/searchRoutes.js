const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.get('/tasks', searchController.searchTasks);
router.get('/auditeurs', searchController.searchAuditeurs);
router.get('/users', searchController.searchUsers);

module.exports = router;