const { customAlphabet } = require('nanoid/non-secure'); 
const Room = require('../models/Room');
const User = require('../models/User');
const Notification = require('../models/Notification');

const createRoom = async (req, res) => {
  const { name, description, themeColor, size, avatar } = req.body; // ✅ Add avatar here
  const userId = req.user.id;

  // ✅ Updated validation to include avatar
  if (!name || !themeColor || !size || !avatar) {
    return res.status(400).json({ message: 'Room name, theme color, size, and avatar are required' });
  }

  try {
    const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);
    const roomCode = nanoid(); 

    const newRoom = await Room.create({
      name,
      roomCode,
      description: description || '',
      themeColor,
      size,
      avatar,
      admin: userId,
      members: [userId],
    });

    res.status(201).json({ room: newRoom });
  } catch (error) {
    console.error('Create Room Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { createRoom };




const joinRoom = async (req, res) => {
  const { roomCode } = req.body;
  const userId = req.user.id;

  try {
    const room = await Room.findOne({ roomCode }).populate('members');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is already in the room
    const alreadyMember = room.members.some(
      member => member._id.toString() === userId
    );
    if (alreadyMember) {
      return res.status(400).json({ message: 'Already a member of this room' });
    }

    // Add user to room
    room.members.push(userId);
    await room.save();

    // Fetch user info
    const user = await User.findById(userId);

    // Create notification message
    const message = `${user.name} joined the room`;

    // Get receivers (other members)
    const receiverIds = room.members
      .map(member => member._id.toString())
      .filter(id => id !== userId);

    // Only create and send notification if there are receivers
    if (receiverIds.length > 0) {
      const notification = await Notification.create({
        roomId: room._id,
        sender: userId,
        receivers: receiverIds,
        type: 'joined',
        message,
      });

      console.log('Join Room Notification Created:', notification);

      // Send real-time notification
      global.io.to(room._id.toString()).emit('receiveNotification', {
        message,
        type: 'joined',
        senderName: user.name,
        roomId: room._id,
        createdAt: notification.createdAt,
      });
    }

    // Join socket room
    global.io.sockets.sockets.forEach(socket => {
      if (socket.userId === userId) {
        socket.join(room._id.toString());
      }
    });

    res.status(200).json({ message: 'Joined room successfully', room });
  } catch (err) {
    console.error('Join Room Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};



module.exports = {
  createRoom,
  joinRoom
};
