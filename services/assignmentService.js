const mongoose = require('mongoose');

/**
 * assignmentService.js
 * Service implementing the semi-automatic assignment proposal workflow.
 * Exports: createProposal(taskId, options)
 *
 * Notes:
 * - Uses existing Mongoose models when available: Tache, User, Affectation.
 * - Persists a proposal using the AssignmentProposal model (created alongside).
 */

async function loadModel(pathCandidates) {
  for (const p of pathCandidates) {
    try {
      const possible = require(p);
      if (possible) return possible && (possible.default || possible[p.split('/').pop()] || possible);
    } catch (e) {
      // continue
    }
  }
  return null;
}

async function getModels() {
  const Tache = (await loadModel(['../models/Tache', './models/Tache'])) || require('../models/Tache');
  const User = (await loadModel(['../models/User', './models/User'])) || require('../models/User');
  const Affectation = (await loadModel(['../models/Affectation', './models/Affectation'])) || require('../models/Affectation');
  const Auditeur = (await loadModel(['../models/Auditeur', './models/Auditeur'])) || null;
  const AssignmentProposal = (await loadModel(['../models/AssignmentProposal'])) || null;
  return { Tache, User, Affectation, Auditeur, AssignmentProposal };
}

function overlap(taskStart, taskEnd, aStart, aEnd) {
  if (!taskStart || !taskEnd || !aStart || !aEnd) return false;
  const ts = new Date(taskStart).getTime();
  const te = new Date(taskEnd).getTime();
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  return !(te < as || ts > ae);
}

async function computeRotationOrder(auditeurs, Affectation) {
  // similar to rotationController: compute lastAffectation per auditeur and sort
  const AffCol = mongoose.connection.collection('affectations');
  const withMeta = await Promise.all(auditeurs.map(async (a) => {
    const audId = a._id || a.id || null;
    let last = null;
    try {
      const lastAff = await AffCol.find({ auditeurId: audId }).sort({ dateAffectation: -1 }).limit(1).toArray();
      if (lastAff && lastAff.length) last = lastAff[0].dateAffectation || lastAff[0].dateReponse || null;
    } catch (e) {}
    return Object.assign({}, a, { lastAffectation: last || null });
  }));

  withMeta.sort((x, y) => {
    const ax = (x.anciennete || 0);
    const ay = (y.anciennete || 0);
    if (ay !== ax) return ay - ax; // desc
    const lx = x.lastAffectation ? new Date(x.lastAffectation).getTime() : 0;
    const ly = y.lastAffectation ? new Date(y.lastAffectation).getTime() : 0;
    if (lx !== ly) return lx - ly; // older first
    const nx = x.nombre_des_taches || 0;
    const ny = y.nombre_des_taches || 0;
    return nx - ny;
  });

  return withMeta.map(a => (a._id || a.id).toString());
}

async function createProposal(taskId, options = {}) {
  // delegate to computeProposal which returns the proposal data (not persisted)
  const { AssignmentProposal } = await getModels();
  const proposalData = await computeProposal(taskId);

  // if model available, persist (keep existing behavior)
  let proposal = proposalData;
  if (AssignmentProposal) {
    try {
      const doc = new AssignmentProposal(proposalData);
      await doc.save();
      proposal = doc.toObject ? doc.toObject() : doc;
    } catch (e) {
      // if save fails, just return computed proposal
      proposal = proposalData;
    }
  }

  return proposal;
}

// computeProposal: same logic as createProposal but without persisting
async function computeProposal(taskId) {
  const { Tache, User, Affectation } = await getModels();

  const task = await Tache.findById(taskId).lean();
  if (!task) throw new Error('Task not found');

  let auditors = [];
  try {
    auditors = await User.find({ role: 'AUDITEUR', estActif: true }).lean();
  } catch (e) {
    const col = mongoose.connection.collection('user');
    auditors = await col.find({ role: 'AUDITEUR' }).toArray();
  }

  const auditorsIds = auditors.map(a => (a._id || a.id));

  // Merge Auditeur profiles (specialite, anciennete...) when available
  if (typeof Auditeur !== 'undefined' && Auditeur) {
    try {
      let profiles = [];
      try {
        profiles = await Auditeur.find({ userId: { $in: auditorsIds } }).lean();
      } catch (err) {
        const audCol = mongoose.connection.collection('auditeurs');
        const idsForQuery = auditorsIds.map(id => (id && id.toString) ? new mongoose.Types.ObjectId(id.toString()) : id);
        profiles = await audCol.find({ userId: { $in: idsForQuery } }).toArray();
      }
      const byUserId = {};
      for (const p of profiles) {
        if (!p || !p.userId) continue;
        byUserId[p.userId.toString()] = p;
      }
      auditors = auditors.map(u => {
        const id = (u._id || u.id).toString();
        const prof = byUserId[id];
        if (prof) {
          return Object.assign({}, u, {
            specialite: prof.specialite,
            anciennete: prof.anciennete,
            nombre_des_taches: prof.nombre_des_taches,
            diplomes: prof.diplomes,
            formations: prof.formations
          });
        }
        return u;
      });
    } catch (e) {
      console.error('assignmentService: failed to merge Auditeur profiles', e && e.message);
    }
  }

  const rotation = await computeRotationOrder(auditors, Affectation);

  const activeAssignments = await Affectation.find({ statut: { $in: ['ACCEPTEE', 'EN_COURS'] } }).populate('tacheId', 'dateDebut dateFin').lean();

  const history = await Affectation.find({ auditeurId: { $in: auditorsIds } }).lean();

  const excluded = [];
  const eligible = [];

  for (const auditor of auditors) {
    const reason = [];
    // task may use `specialitesConcernees` (model) or `specialites` (legacy payload)
    const taskSpecialites = task.specialitesConcernees || task.specialites || [];
    const taskType = task.type || task.specialite || null;
    const audSpec = auditor.specialite || auditor.specialitesConcernees || auditor.specialites || null;

    // Normalization helpers
    const normalize = v => (v === null || v === undefined) ? null : String(v).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_');
    const normArr = arr => Array.isArray(arr) ? arr.map(x => normalize(x)).filter(Boolean) : (arr ? [normalize(arr)].filter(Boolean) : []);
    const taskSpecsNorm = normArr(taskSpecialites);
    const taskTypeNorm = normalize(taskType);
    const audSpecNormArr = normArr(audSpec);

    // canonical mapping of variants -> canonical speciality
    const canonicalMap = {
      'pedagogique': 'pedagogique', 'pedagogie': 'pedagogique', 'formateur': 'pedagogique', 'formateurs': 'pedagogique',
      'orientation': 'orientation', 'orient': 'orientation',
      'planification': 'planification', 'planif': 'planification',
      'services_financiers': 'services_financiers', 'financier': 'services_financiers', 'finance': 'services_financiers'
    };

    // Build effective specialites (use specialitesConcernees when present, otherwise map type)
    let effectiveSpecialitesNorm = (taskSpecsNorm && taskSpecsNorm.length) ? taskSpecsNorm.slice() : [];
    if ((!effectiveSpecialitesNorm || effectiveSpecialitesNorm.length === 0) && taskTypeNorm) {
      if (canonicalMap[taskTypeNorm]) effectiveSpecialitesNorm = [canonicalMap[taskTypeNorm]];
      else {
        // strict mode: task has no specialites and type is not mappable -> mark as misconfigured
        const excludedAll = auditors.map(a => ({ auditorId: (a._id || a.id) }));
        return { taskId: task._id, candidats: [], eligible: [], exclus: excludedAll, status: 'computed', createdAt: new Date() };
      }
    }

    if (effectiveSpecialitesNorm && effectiveSpecialitesNorm.length) {
      const matches = audSpecNormArr && audSpecNormArr.length ? audSpecNormArr.some(s => effectiveSpecialitesNorm.includes(s)) : false;
      if (!matches) reason.push('specialite');
    }

    // task may use `gradesConcernes` (model) or `grades` (legacy payload)
    const taskGrades = task.gradesConcernes || task.grades || [];
    if (taskGrades && taskGrades.length) {
      const audGrade = auditor.grade || auditor.gradesConcernes || auditor.grades || null;
      const matchesGrade = audGrade ? (Array.isArray(audGrade) ? audGrade.some(g => taskGrades.includes(g)) : taskGrades.includes(audGrade)) : false;
      if (!matchesGrade) reason.push('grade');
    }

    const hasConflict = activeAssignments.some(a => {
      const audId = (a.auditeurId || a.auditorId || '').toString();
      const curAudId = (auditor._id || auditor.id || '').toString();
      if (audId !== curAudId) return false;
      const t = a.tacheId || {};
      return overlap(task.dateDebut, task.dateFin, t.dateDebut, t.dateFin);
    });
    if (hasConflict) reason.push('chevauchement');

    if (reason.length) {
      excluded.push({ auditorId: auditor._id || auditor.id, reasons: reason });
    } else {
      eligible.push(auditor);
    }
  }

  const eligibleWithScores = eligible.map(auditor => {
    const copy = Object.assign({}, auditor);
    let score = 0;
    const position = rotation.indexOf((auditor._id || auditor.id).toString());
    score += (rotation.length - (position >= 0 ? position : rotation.length)) * 10;

    const remuneratedTasks = history.filter(h => (h.auditeurId && h.auditeurId.toString() === (auditor._id || '').toString()) && h.remuneree).length;
    score += Math.max(0, 10 - remuneratedTasks);

    const currentTasks = activeAssignments.filter(a => (a.auditeurId || '').toString() === (auditor._id || '').toString()).length;
    score += Math.max(0, 5 - currentTasks);

    copy.score = score;
    return copy;
  });

  eligibleWithScores.sort((a, b) => b.score - a.score);

  const numberToSelect = task.nombrePlaces || 1;
  const selected = eligibleWithScores.slice(0, numberToSelect);

  const proposalData = {
    taskId: task._id,
    candidats,
    eligible: eligibleWithScores.map(e => ({ auditorId: e._id || e.id, score: e.score, auditor: e })),
    exclus: excluded.map(e => ({ auditorId: e.auditorId })),
    status: 'computed',
    createdAt: new Date()
  };

  return proposalData;

}

module.exports = { createProposal, computeProposal };
