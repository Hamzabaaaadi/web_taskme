const Chat = require('../models/Chat')
const Message = require('../models/Message')

exports.getChatByTask = async (req, res) => {
  try {
    const { taskId } = req.query
    if (!taskId) return res.status(400).json({ error: 'taskId required' })
    const chat = await Chat.findOne({ tacheId: taskId })
      .populate({ path: 'messages', populate: { path: 'expediteurId', select: '_id nom prenom' } })
      .populate('participants', '_id nom prenom')
      .lean()
    return res.json({ chat })
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