const { customAlphabet } = require('nanoid/non-secure'); 
const Room = require('../models/Room');

const createRoom = async (req, res) => {
  const { name } = req.body;
  const userId = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Room name is required' });
  }

  try {
    const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);
    const roomCode = nanoid(); 

    const newRoom = await Room.create({
      name,
      roomCode,
      admin: userId,
      members: [userId],
    });

    res.status(201).json({ room: newRoom });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};


const joinRoom = async (req, res) => {
  const { roomCode } = req.body;

  try {
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already a member of this room' });
    }

    room.members.push(req.user.id);
    await room.save();

    res.status(200).json({ message: 'Joined room successfully', room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createRoom,
  joinRoom
};
