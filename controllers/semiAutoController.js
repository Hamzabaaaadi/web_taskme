const semiautoService = require('../services/semiautoService');

function removeEmbedding(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(removeEmbedding);
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'embedding') continue;
      // For nested auditor objects, also strip embedding
      if (k === 'auditor' && v && typeof v === 'object') {
        out[k] = removeEmbedding(v);
        continue;
      }
      out[k] = removeEmbedding(v);
    }
    return out;
  }
  return obj;
}

async function propose(req, res) {
  const { taskId } = req.params;
  try {
    const debug = req.query && (req.query.debug === '1' || req.query.debug === 'true');
    const full = req.query && (req.query.full === '1' || req.query.full === 'true');
    const proposal = await semiautoService.propose(taskId, { debug });

    // Remove any `embedding` fields from auditors before returning to clients
    const cleaned = removeEmbedding(proposal);

    // By default return a compact response with only the selected candidates (candidats)
    // Use ?full=1 to get the complete proposal (eligible, exclus, diagnostics)
    if (!full && !debug) {
      return res.json({ taskId: cleaned.taskId, nombrePlaces: cleaned.nombrePlaces, candidats: cleaned.candidats });
    }

    return res.json(cleaned);
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
