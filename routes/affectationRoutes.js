const express = require('express');
const router = express.Router();

const affectationController = require('../controllers/affectationController');
// Diagnostic: log exported keys to detect undefined handlers
try { console.log('affectationController keys=', Object.keys(affectationController)); } catch (e) { console.warn('Unable to list affectationController keys', e && e.message); }
const { basicAuth } = require('../middlewares/authMiddleware');

router.get('/me', basicAuth, affectationController.getMyAffectations);

router.get('/', affectationController.list);
// Modifier une affectation (maximum 5 champs: mode, tacheId, auditeurId, dateAffectation, estValidee)
router.put('/:id', basicAuth, affectationController.updateAffectation);
router.put('/:id/accept', basicAuth, affectationController.acceptAffectation);
router.put('/:id/refuse', basicAuth, affectationController.refuseAffectation);
router.delete('/:id', affectationController.deleteAffectation);
// Endpoints pour l'intégration IA (pas de token requis)
// Note: ces routes sont publiques par conception ici — assurez-vous
// que votre réseau ou proxy protège ces endpoints si nécessaire.
router.post('/proposer-ia', affectationController.proposerIA);
router.post('/:id/valider-ia', affectationController.validerIA);

module.exports = router;
