const Chat = require('../models/Chat')
const Message = require('../models/Message')

const User = require('../models/User')
const Auditeur = require('../models/Auditeur')

// Fonction utilitaire pour récupérer _id, nom, prenom de l'expéditeur (User ou Auditeur)
async function getExpediteurInfo(expediteurId) {
  let user = await User.findById(expediteurId).select('_id nom prenom').lean()
  if (user) {
    return { _id: user._id, nom: user.nom, prenom: user.prenom }
  }
  let auditeur = await Auditeur.findById(expediteurId).lean()
  if (auditeur) {
    let userAud = await User.findById(auditeur.userId).select('_id nom prenom').lean()
    if (userAud) {
      return { _id: auditeur._id, nom: userAud.nom, prenom: userAud.prenom }
    }
  }
  return null
}

exports.getChatByTask = async (req, res) => {
  try {
    const { taskId } = req.query
    if (!taskId) return res.status(400).json({ error: 'taskId required' })
    let chat = await Chat.findOne({ tacheId: taskId })
      .populate('participants', '_id nom prenom')
      .lean()

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Récupérer tous les messages
    let messages = []
    if (Array.isArray(chat.messages) && chat.messages.length) {
      const rawMessages = await Message.find({ _id: { $in: chat.messages } }).lean()
      messages = await Promise.all(rawMessages.map(async msg => {
        const expediteur = await getExpediteurInfo(msg.expediteurId)
        return {
          ...msg,
          expediteur
        }
      }))
    }

    return res.json({ chat: { ...chat, messages } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}


exports.createOrPost = async (req, res) => {
  try {
    const { tacheId, participants, expediteurId, contenu, dateEnvoi } = req.body
    if (!tacheId) return res.status(400).json({ error: 'tacheId required' })

    // find or create chat for this task
    let chat = await Chat.findOne({ tacheId })
    if (!chat && Array.isArray(participants) && participants.length) {
      chat = await Chat.create({ tacheId, participants })
      return res.status(201).json({ chat })
    }
    if (!chat) {
      chat = await Chat.create({ tacheId, participants: participants || [] })
    }

    // if contenu present => create message and attach to chat
    if (contenu) {
      const msg = await Message.create({
        expediteurId,
        contenu,
        dateEnvoi: dateEnvoi || new Date()
      })
      chat.messages.push(msg._id)
      await chat.save()
      const populatedMsg = await Message.findById(msg._id).populate('expediteurId', '_id nom prenom').lean()
      return res.status(201).json({ message: populatedMsg, chatId: chat._id })
    }

    // otherwise return chat
    return res.json({ chat })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
