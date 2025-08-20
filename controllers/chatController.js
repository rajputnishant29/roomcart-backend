const ChatMessage = require('../models/ChatMessage');

// GET /api/chat/:roomId => get all messages for a room
exports.createMessage = async (req, res) => {
  try {
    const { roomId, senderId, senderName, text } = req.body;
    const newMessage = new ChatMessage({ roomId, senderId, senderName, text });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Failed to create message' });
  }
};


// POST /api/chat => add a new message (optional, since socket saves this)
// exports.createMessage = async (req, res) => {
//   try {
//     const { roomId, senderId, senderName, text } = req.body;
//     const newMessage = new ChatMessage({ roomId, senderId, senderName, text });
//     await newMessage.save();
//     res.status(201).json(newMessage);
//   } catch (error) {
//     console.error('Error creating message:', error);
//     res.status(500).json({ message: 'Failed to create message' });
//   }
// };
