const mongoose = require('mongoose');

async function loadModel(pathCandidates) {
  for (const p of pathCandidates) {
    try {
      const possible = require(p);
      if (possible) return possible && (possible.default || possible[p.split('/').pop()] || possible);
    } catch (e) {}
  }
  return null;
}

async function getModels() {
  // Try dynamic loading first, then require, then mongoose.models fallback for ESM / pre-registered models
  let Tache = await loadModel(['../models/Tache', './models/Tache']);
  if (!Tache) {
    try { Tache = require('../models/Tache'); } catch (e) { Tache = mongoose.models.Tache || null; }
  }

  let User = await loadModel(['../models/User', './models/User']);
  if (!User) {
    try { User = require('../models/User'); } catch (e) { User = mongoose.models.User || null; }
  }

  let Auditeur = await loadModel(['../models/Auditeur', './models/Auditeur']);
  if (!Auditeur) {
    try { Auditeur = require('../models/Auditeur'); } catch (e) { Auditeur = mongoose.models.Auditeur || null; }
  }

  let Affectation = await loadModel(['../models/Affectation', './models/Affectation']);
  if (!Affectation) {
    try { Affectation = require('../models/Affectation'); } catch (e) { Affectation = mongoose.models.Affectation || null; }
  }

  return { Tache, User, Auditeur, Affectation };
}

function normalizeStr(v) {
  if (v === null || v === undefined) return null;
  return String(v).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_');
}

function getAnciennete(a) {
  if (!a) return 0;
  const cand = a.anciennete || a.ancienneté || a.ancien || a.ancienneteValue || 0;
  const n = Number(cand);
  return Number.isFinite(n) ? n : 0;
}

function getNombreTaches(a) {
  if (!a) return 0;
  const cand = a.nombre_des_taches || a.nombreDesTaches || a.nombre_taches || 0;
  const n = Number(cand);
  return Number.isFinite(n) ? n : 0;
}

async function propose(taskId, options = {}) {
  const { Tache, User, Auditeur, Affectation } = await getModels();
  const task = await Tache.findById(taskId).lean();
  if (!task) throw new Error('Task not found');

  let auditors = await User.find({ role: 'AUDITEUR', estActif: true }).lean();

  if (Auditeur) {
    try {
      const ids = auditors.map(a => (a._id || a.id));
      const profiles = await Auditeur.find({ userId: { $in: ids } }).lean();
      const byUser = {};
      for (const p of profiles) if (p && p.userId) byUser[p.userId.toString()] = p;
      auditors = auditors.map(u => {
        const id = (u._id || u.id).toString();
        const p = byUser[id];
        if (p) return Object.assign({}, u, p);
        return u;
      });
    } catch (e) { /* ignore */ }
  }

  const taskSpecialites = task.specialitesConcernees || task.specialites || [];
  const taskType = task.type || task.specialite || null;
  const taskSpecsNorm = Array.isArray(taskSpecialites) ? taskSpecialites.map(normalizeStr).filter(Boolean) : [];
  const taskTypeNorm = normalizeStr(taskType);

  const canonical = { pedagogique: 'pedagogique', orientation: 'orientation', planification: 'planification', services_financiers: 'services_financiers' };

  let effective = taskSpecsNorm.slice();
  if (effective.length === 0 && taskTypeNorm) {
    if (canonical[taskTypeNorm]) effective = [canonical[taskTypeNorm]];
    else return { taskId: task._id, nombrePlaces: task.nombrePlaces || null, candidats: [], eligible: [], exclus: [] };
  }

  const active = await Affectation.find({ statut: { $in: ['ACCEPTEE','EN_COURS'] } }).populate('tacheId', 'dateDebut dateFin').lean();
  const history = await Affectation.find({ auditeurId: { $in: auditors.map(a => a._id || a.id) } }).lean();

  const excluded = [];
  const eligible = [];
  const diagnostics = [];

  const computeScore = (a) => {
    let score = 0;
    score += (a.anciennete || 0) * 10;
    const curTasks = active.filter(x => (x.auditeurId || '').toString() === (a._id || '').toString()).length;
    score += Math.max(0, 50 - (curTasks * 10));
    const rem = history.filter(h => (h.auditeurId && h.auditeurId.toString() === (a._id || '').toString()) && h.remuneree).length;
    score += Math.max(0, 20 - rem * 5);
    return score;
  };

  for (const a of auditors) {
    const reasons = [];
    const audSpec = a.specialite || a.specialitesConcernees || a.specialites || null;
    const audSpecNorm = audSpec ? (Array.isArray(audSpec) ? audSpec.map(normalizeStr) : [normalizeStr(audSpec)]) : [];

    // matchLevel: 2 = exact task.type match, 1 = matches one of task.specialitesConcernees, 0 = no match
    let matchLevel = 0;
    if (taskTypeNorm && audSpecNorm.includes(taskTypeNorm)) matchLevel = 2;
    else if (audSpecNorm.some(s => effective.includes(s))) matchLevel = 1;
    else matchLevel = 0;

    // Primary criterion: specialty must match. Record match level on the auditor object
    // and if there is no specialty match (matchLevel === 0) mark reason 'specialite'
    a._matchLevel = matchLevel;
    if (matchLevel === 0) {
      reasons.push('specialite');
    }

    const taskGrades = task.gradesConcernes || task.grades || [];
    if (taskGrades && taskGrades.length) {
      const ag = a.grade || a.gradesConcernes || a.grades || null;
      const matchG = ag ? (Array.isArray(ag) ? ag.some(g => taskGrades.includes(g)) : taskGrades.includes(ag)) : false;
      if (!matchG) reasons.push('grade');
    }

    const hasConflict = active.some(x => {
      const audId = (x.auditeurId || x.auditorId || '').toString();
      const curId = (a._id || a.id || '').toString();
      if (audId !== curId) return false;
      const t = x.tacheId || {};
      if (!t.dateDebut || !t.dateFin || !task.dateDebut || !task.dateFin) return false;
      const ts = new Date(task.dateDebut).getTime();
      const te = new Date(task.dateFin).getTime();
      const as = new Date(t.dateDebut).getTime();
      const ae = new Date(t.dateFin).getTime();
      return !(te < as || ts > ae);
    });
    if (hasConflict) reasons.push('chevauchement');

    if (process.env.DEBUG_ASSIGNMENTS === 'true') {
      try {
        const name = a.nom || a.name || a.fullName || '';
        console.log('[semiauto] auditor', (a._id || a.id).toString(), name, 'specNorm=', audSpecNorm, 'matchLevel=', matchLevel, 'reasons=', reasons);
      } catch (e) { /* ignore */ }
    }

    if (reasons.length) {
      excluded.push({ auditorId: a._id || a.id, reasons });
    } else {
      eligible.push(a);
    }

    // collect diagnostics if requested
    if (options.debug) {
      diagnostics.push({ auditorId: a._id || a.id, name: a.nom || a.name || a.fullName || null, audSpec: audSpec, audSpecNorm, matchLevel, reasons });
    }
  }

  // scoring: give strong priority to matchLevel, then anciennete and other factors
  const eligibleScores = eligible.map(a => {
    const base = computeScore(a);
    const matchBonus = (a._matchLevel || 0) * 1000;
    const score = matchBonus + base;
    const anciennete = getAnciennete(a);
    const nombre_des_taches = getNombreTaches(a);
    return { auditor: a, score, matchLevel: a._matchLevel || 0, anciennete, nombre_des_taches };
  });
  // Sort by: matchLevel desc, anciennete desc, then lower load (nombre_des_taches), then score desc
  eligibleScores.sort((x, y) => {
    if ((y.matchLevel || 0) !== (x.matchLevel || 0)) return (y.matchLevel || 0) - (x.matchLevel || 0);
    if ((y.anciennete || 0) !== (x.anciennete || 0)) return (y.anciennete || 0) - (x.anciennete || 0);
    if ((x.nombre_des_taches || 0) !== (y.nombre_des_taches || 0)) return (x.nombre_des_taches || 0) - (y.nombre_des_taches || 0);
    return (y.score || 0) - (x.score || 0);
  });

  const auditorsById = {};
  for (const a of auditors) auditorsById[(a._id || a.id).toString()] = a;

  let excludedScores = excluded.map(e => {
    const id = (e.auditorId || '').toString();
    const aud = auditorsById[id];
    const score = aud ? computeScore(aud) : 0;
    return { auditor: aud, score, reasons: e.reasons };
  });
  // Only consider excluded auditors that do have a matching specialty (matchLevel>0)
  // auditors with matchLevel === 0 are permanently ineligible per new requirement
  excludedScores = excludedScores.filter(es => es.auditor && (es.auditor._matchLevel || 0) > 0);
  excludedScores.sort((x, y) => {
    // prefer higher matchLevel among excluded (if present), then anciennete, then lower load, then score
    const xm = (x.auditor && (x.auditor._matchLevel || 0)) || 0;
    const ym = (y.auditor && (y.auditor._matchLevel || 0)) || 0;
    if (ym !== xm) return ym - xm;
    const xa = getAnciennete(x.auditor);
    const ya = getAnciennete(y.auditor);
    if (ya !== xa) return ya - xa;
    const xload = getNombreTaches(x.auditor);
    const yload = getNombreTaches(y.auditor);
    if (xload !== yload) return xload - yload;
    return (y.score || 0) - (x.score || 0);
  });

  const numberToSelect = task.nombrePlaces || 1;
  const candidats = [];

  for (const s of eligibleScores.slice(0, numberToSelect)) {
    candidats.push({ auditorId: s.auditor._id || s.auditor.id, score: s.score, auditor: s.auditor, requiresApproval: false, reasons: [] });
  }

  if (candidats.length < numberToSelect) {
    const need = numberToSelect - candidats.length;
    for (let i = 0; i < Math.min(need, excludedScores.length); i++) {
      const s = excludedScores[i];
      candidats.push({ auditorId: s.auditor && (s.auditor._id || s.auditor.id), score: s.score, auditor: s.auditor, requiresApproval: true, reasons: s.reasons });
    }
  }

  // If still not enough candidates, allow a controlled fallback to "secondary" specialties.
  // secondaryMap lists related specialties for a given task type to broaden selection.
  if (candidats.length < numberToSelect) {
    const need2 = numberToSelect - candidats.length;
    const secondaryMap = {
      pedagogique: ['orientation','planification'],
      orientation: ['pedagogique','planification'],
      planification: ['pedagogique','orientation'],
      services_financiers: ['planification']
    };

    const secondaryCandidates = new Set();
    if (taskTypeNorm && secondaryMap[taskTypeNorm]) {
      for (const s of secondaryMap[taskTypeNorm]) secondaryCandidates.add(s);
    }
    // also include other task specialites as secondary sources
    for (const s of taskSpecsNorm) secondaryCandidates.add(s);

    const secondaryList = [];
    for (const e of excluded) {
      const id = (e.auditorId || '').toString();
      const aud = auditorsById[id];
      if (!aud) continue;
      const audSpec = aud.specialite || aud.specialitesConcernees || aud.specialites || null;
      const audSpecNorm = audSpec ? (Array.isArray(audSpec) ? audSpec.map(normalizeStr) : [normalizeStr(audSpec)]) : [];
      const hasSecondary = audSpecNorm.some(s => secondaryCandidates.has(s));
      const isPrimaryMatch = (aud._matchLevel || 0) > 0;
      if (!isPrimaryMatch && hasSecondary) {
        secondaryList.push({ auditor: aud, audSpecNorm });
      }
    }

    // compute scores for secondary list and sort
    const secondaryScores = secondaryList.map(x => ({ auditor: x.auditor, score: computeScore(x.auditor) }));
    secondaryScores.sort((a,b) => b.score - a.score);

    for (let i=0; i<Math.min(need2, secondaryScores.length); i++) {
      const s = secondaryScores[i];
      candidats.push({ auditorId: s.auditor && (s.auditor._id || s.auditor.id), score: s.score, auditor: s.auditor, requiresApproval: true, reasons: ['secondary_specialite'] });
    }
  }

  if (process.env.DEBUG_ASSIGNMENTS === 'true') {
    console.log('[semiauto] selected', candidats.length, 'for task', task._id && task._id.toString ? task._id.toString() : task._id, 'needed', numberToSelect);
  }

  const result = { taskId: task._id, nombrePlaces: task.nombrePlaces || null, candidats, eligible: eligibleScores.map(s => ({ auditorId: s.auditor._id || s.auditor.id, score: s.score, auditor: s.auditor })), exclus: excluded };
  if (options.debug) result.diagnostics = diagnostics;
  return result;
}

module.exports = { propose };
