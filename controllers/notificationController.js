const notificationService = require('../services/notificationService');

async function listForUser(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Non authentifié' });
    const notifications = await notificationService.listForUser(user._id, { limit: 100 });
    return res.json({ notifications });
  } catch (e) {
    console.error('notificationController.listForUser error:', e);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function markRead(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Non authentifié' });
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });
    const notif = await notificationService.markRead(id, user._id);
    return res.json({ message: 'Notifié lu', notification: notif });
  } catch (e) {
    console.error('notificationController.markRead error:', e && e.message ? e.message : e);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function deleteNotification(req, res) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Non authentifié' });
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Id requis' });
    await notificationService.deleteNotification(id, user._id);
    return res.json({ message: 'Notification supprimée' });
  } catch (e) {
    console.error('notificationController.deleteNotification error:', e && e.message ? e.message : e);
    if (e && e.message === 'Not allowed') return res.status(403).json({ message: 'Non autorisé' });
    if (e && e.message === 'Notification not found') return res.status(404).json({ message: "Notification introuvable" });
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function create(req, res) {
  try {
    const { destinataireId, type, titre, message, data, sendEmail } = req.body || {};
    if (!destinataireId || !type || !message) {
      return res.status(400).json({ message: 'Champs requis: destinataireId, type, message' });
    }
    // destinataireId peut être un tableau ou une string
    const recipients = Array.isArray(destinataireId) ? destinataireId : [destinataireId];
    const notifications = await notificationService.createAndSend({
      type,
      titre,
      message,
      data,
      recipients,
      sendEmail: !!sendEmail,
      realtime: true
    });
    return res.status(201).json({ message: 'Notifications envoyées', notifications });
  } catch (e) {
    console.error('notificationController.create error:', e && e.message ? e.message : e);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { listForUser, markRead, create, deleteNotification };
