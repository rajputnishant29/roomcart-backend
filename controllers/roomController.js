const { customAlphabet } = require('nanoid/non-secure'); 
const Room = require('../models/Room');
const User = require('../models/User');
const Notification = require('../models/Notification');

const createRoom = async (req, res) => {
  const { name, description, themeColor, size, avatar } = req.body;
  const userId = req.user.id;

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

// module.exports = { createRoom };

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

    // Access io from server.js
    const io = req.app.get('io');

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
      io.to(room._id.toString()).emit('receiveNotification', {
        message,
        type: 'joined',
        senderName: user.name,
        roomId: room._id,
        createdAt: notification.createdAt,
      });
    }

    // Join socket room safely
    for (const [id, socket] of io.sockets.sockets) {
      if (socket.userId === userId) {
        socket.join(room._id.toString());
      }
    }

    res.status(200).json({ message: 'Joined room successfully', room });
  }catch (err) {
  console.error('Join Room Error:', err);
  return res.status(500).json({ message: 'Server error', error: err.message });
}
}






const getRoomActivities = async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;

  try {
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check authorization: user must be admin or member of the room
    const isMember =
      room.admin.toString() === userId.toString() ||
      room.members.some((memberId) => memberId.toString() === userId.toString());

    if (!isMember) {
      return res.status(403).json({ message: 'You are not authorized to view activities for this room' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const notifications = await Notification.find({ roomId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', '_id name avatar');

    const activities = notifications.map((act) => ({
      id: act._id,
      type: act.type,
      actor: {
        id: act.sender?._id || null,
        name: act.sender?.name || 'Unknown',
        avatar: act.sender?.avatar || null,
      },
      roomId: act.roomId,
      message: act.message || '',
      createdAt: act.createdAt,
    }));

    res.status(200).json({ activities });
  } catch (err) {
    console.error('Get Room Activities Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoomActivities,
};

