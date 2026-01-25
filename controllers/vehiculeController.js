const Vehicule = require('../models/Vehicule');

exports.list = async (req, res) => {
  try {
    const filter = req.query || {};
    const vehicules = await Vehicule.find(filter).lean();
    res.json({ vehicules });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.create = async (req, res) => {
  try {
    const vehicule = await Vehicule.create(req.body);
    res.status(201).json({ vehicule });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.update = async (req, res) => {
  try {
    const vehicule = await Vehicule.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!vehicule) return res.status(404).json({ message: 'Véhicule non trouvé' });
    res.json({ vehicule });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};

exports.delete = async (req, res) => {
  try {
    const vehicule = await Vehicule.findByIdAndDelete(req.params.id).lean();
    if (!vehicule) return res.status(404).json({ message: 'Véhicule non trouvé' });
    res.json({ message: 'Véhicule supprimé', vehicule });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', err });
  }
};