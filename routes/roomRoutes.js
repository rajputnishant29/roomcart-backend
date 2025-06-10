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


module.exports = router;
