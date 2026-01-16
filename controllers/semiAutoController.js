const semiautoService = require('../services/semiautoService');

async function propose(req, res) {
  const { taskId } = req.params;
  try {
    const debug = req.query && (req.query.debug === '1' || req.query.debug === 'true');
    const full = req.query && (req.query.full === '1' || req.query.full === 'true');
    const proposal = await semiautoService.propose(taskId, { debug });

    // By default return a compact response with only the selected candidates (candidats)
    // Use ?full=1 to get the complete proposal (eligible, exclus, diagnostics)
    if (!full && !debug) {
      return res.json({ taskId: proposal.taskId, nombrePlaces: proposal.nombrePlaces, candidats: proposal.candidats });
    }

    return res.json(proposal);
  } catch (err) {
    console.error('semiautoController.propose error:', err && err.message ? err.message : err);
    // If service couldn't find the task, return 404 to make the client error clearer
    if (err && err.message === 'Task not found') {
      return res.status(404).json({ error: 'Task not found', details: err.message });
    }
    return res.status(500).json({ error: 'Unable to compute semiauto proposal', details: err.message || err });
  }
}

module.exports = { propose };
// Legacy semi-auto endpoint removed. Use `/api/semiauto/propose/:taskId` instead.
exports.createProposal = async (req, res) => {
  return res.status(410).json({ error: 'Legacy semi-auto endpoint removed. Use /api/semiauto/propose/:taskId' });
};
