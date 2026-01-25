const express = require('express')
const router = express.Router()
const controller = require('../controllers/chatController')

router.get('/', controller.getChatByTask)    // GET /chats?taskId=...
router.post('/', controller.createOrPost)    // POST /chats

module.exports = router