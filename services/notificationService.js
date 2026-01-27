const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const socketLib = require('../lib/socket');
const User = require('../models/User');


async function emitRealtimeToUser(userId, payload) {
  try {
    const io = socketLib.get();
    io.to(`user_${userId}`).emit('notification', payload);
  } catch (e) {
    // no socket available or not initialized
  }
}



async function createAndSend({ type, titre, message, data = {}, recipients = [], sendEmail = false, realtime = true }) {
  if (!Array.isArray(recipients)) recipients = [recipients];
  const created = [];
  for (const r of recipients) {
    try {
      const notif = await Notification.create({ destinataireId: r, type, titre, message, dateEnvoi: new Date() });
      created.push(notif);

      const payload = {
        id: notif._id,
        type,
        titre,
        message,
        data,
        dateEnvoi: notif.dateEnvoi
      };

      if (realtime) await emitRealtimeToUser(r, payload);
      // email notification supprimée
    } catch (e) {
      console.warn('notificationService.createAndSend error:', e && e.message ? e.message : e);
    }
  }
  return created;
}

async function listForUser(userId, { limit = 50, skip = 0 } = {}) {
  return Notification.find({ destinataireId: userId }).sort({ dateEnvoi: -1 }).skip(skip).limit(limit).lean();
}

async function markRead(notificationId, userId) {
  // existing model has estLue boolean per notification; mark true
  const notif = await Notification.findById(notificationId);
  if (!notif) throw new Error('Notification not found');
  if (String(notif.destinataireId) !== String(userId)) throw new Error('Not allowed');
  notif.estLue = true;
  await notif.save();
  return notif;
}

async function deleteNotification(notificationId, userId) {
  const notif = await Notification.findById(notificationId);
  if (!notif) throw new Error('Notification not found');
  if (String(notif.destinataireId) !== String(userId)) throw new Error('Not allowed');
  await Notification.deleteOne({ _id: notificationId });
  return { deletedId: notificationId };
}

module.exports = { createAndSend, listForUser, markRead, deleteNotification };
