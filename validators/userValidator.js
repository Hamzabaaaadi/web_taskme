function loginValidator(req, res, next) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

  const re = /\S+@\S+\.\S+/;
  if (typeof email !== 'string' || !re.test(email)) return res.status(400).json({ message: 'Email invalide' });
  if (typeof password !== 'string' || password.length < 3) return res.status(400).json({ message: 'Mot de passe invalide' });

  next();
}

function registerValidator(req, res, next) {
  const { nom, prenom, email, password, role } = req.body || {};
  if (!nom || !prenom) return res.status(400).json({ message: 'Nom et prénom requis' });
  if (!email || !password) return res.status(400).json({ message: 'Email et mot de passe requis' });

  const re = /\S+@\S+\.\S+/;
  if (typeof email !== 'string' || !re.test(email)) return res.status(400).json({ message: 'Email invalide' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ message: 'Mot de passe trop court (>=6)' });

  const roles = ['SUPER_ADMIN', 'COORDINATEUR', 'AUDITEUR'];
  if (!roles.includes(role)) return res.status(400).json({ message: 'Role invalide' });

  next();
}

module.exports = { loginValidator, registerValidator };

function updateProfileValidator(req, res, next) {
  const { nom, prenom, email, password } = req.body || {};
  if (email) {
    const re = /\S+@\S+\.\S+/;
    if (typeof email !== 'string' || !re.test(email)) return res.status(400).json({ message: 'Email invalide' });
  }
  if (password && (typeof password !== 'string' || password.length < 6)) return res.status(400).json({ message: 'Mot de passe trop court (>=6)' });
  if (nom && typeof nom !== 'string') return res.status(400).json({ message: 'Nom invalide' });
  if (prenom && typeof prenom !== 'string') return res.status(400).json({ message: 'Prénom invalide' });
  next();
}

module.exports.updateProfileValidator = updateProfileValidator;

function updateUserValidator(req, res, next) {
  const { nom, prenom, email, password, role, estActif } = req.body || {};
  
  if (nom !== undefined && typeof nom !== 'string') {
    return res.status(400).json({ message: 'Nom invalide' });
  }
  if (prenom !== undefined && typeof prenom !== 'string') {
    return res.status(400).json({ message: 'Prénom invalide' });
  }
  if (email !== undefined) {
    const re = /\S+@\S+\.\S+/;
    if (typeof email !== 'string' || !re.test(email)) {
      return res.status(400).json({ message: 'Email invalide' });
    }
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
    return res.status(400).json({ message: 'Mot de passe trop court (>=6)' });
  }
  if (role !== undefined) {
    const roles = ['SUPER_ADMIN', 'COORDINATEUR', 'AUDITEUR'];
    if (!roles.includes(role)) {
      return res.status(400).json({ message: 'Role invalide' });
    }
  }
  if (estActif !== undefined && typeof estActif !== 'boolean') {
    return res.status(400).json({ message: 'estActif doit être un booléen' });
  }
  
  next();
}

module.exports.updateUserValidator = updateUserValidator;