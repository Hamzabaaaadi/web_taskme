const express = require('express');
const router = express.Router();

const assignmentController = require('../controllers/assignmentController');
// eligibleAuditorsController removed — use /api/semiauto for fresh semi-auto API

// GET /api/assignments/active/:auditorId
router.get('/active/:auditorId', assignmentController.getActiveAssignments);

// NOTE: legacy eligible endpoints removed. New API available under `/api/semiauto`.

module.exports = router;
