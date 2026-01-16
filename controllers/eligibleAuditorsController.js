// legacy controller removed — use /api/semiauto endpoints instead
async function deprecated(req, res) {
  return res.status(410).json({ error: 'This endpoint has been removed. Use /api/semiauto/propose/:taskId' });
}

module.exports = { getEligibleForTask: deprecated };

async function getEligibleForTaskDebug(req, res) {
  const { taskId } = req.params;
  try {
    const proposal = await assignmentService.computeProposal(taskId, { debug: true });
    return res.json(proposal);
  } catch (err) {
    console.error('Error computing eligible auditors (debug)', err.message || err);
    return res.status(500).json({ error: 'Unable to compute eligible auditors (debug)', details: err.message });
  }
}

module.exports.getEligibleForTaskDebug = getEligibleForTaskDebug;
