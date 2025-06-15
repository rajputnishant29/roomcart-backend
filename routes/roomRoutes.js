const express = require('express');
const router = express.Router();
const { createRoom,joinRoom} = require('../controllers/roomController');
const protect = require('../middlewares/auth'); // JWT auth
const auth = require('../middlewares/auth')
const Room = require('../models/Room')

router.post('/create', protect, createRoom);
router.post('/join', auth, joinRoom);

router.get('/my-rooms', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user.id })
      .populate('admin', 'name')       // ✅ populating the admin's name
      .populate('members', 'name');    // ✅ populating members' names
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching user rooms:', error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (room.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the room admin can delete this room' });
    }

    await room.deleteOne();
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('Error deleting room:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


module.exports = router;
