const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');

// ✅ GET all messages for a room by roomId
router.get('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const messages = await ChatMessage.find({ roomId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ✅ POST a new chat message & emit via socket
router.post('/', async (req, res) => {
  const { roomId, senderId, senderName, text } = req.body;

  if (!roomId || !senderId || !senderName || !text) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newMessage = new ChatMessage({
      roomId,
      senderId,
      senderName,
      text,
      timestamp: new Date(),
    });

    await newMessage.save();

    // ✅ Emit to all sockets in the room
    const io = req.app.get('io');
    io.to(roomId).emit('receiveMessage', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Failed to create message' });
  }
});

module.exports = router;
