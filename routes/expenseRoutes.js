const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Room = require('../models/Room');
const auth = require('../middlewares/auth');
const { calculateSettlement } = require('../controllers/expenseController');

// Add Expense to a Room
router.post('/:roomId/add', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, amount, description } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const expense = new Expense({
      room: roomId,
      title,
      amount,
      description,
      addedBy: req.user.id,
    });

    await expense.save();
    res.status(201).json({ message: 'Expense added successfully', expense });
  } catch (err) {
     console.error('Add Expense Error:', err.message, err); // Log the full error
  res.status(500).json({ message: err.message }); 
  }
});

// View all expenses for a room
router.get('/:roomId', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ room: req.params.roomId })  // ✅ use 'room' not 'roomId'
      .populate('addedBy', 'name email');
    res.status(200).json(expenses);
  } catch (err) {
    console.error('View Expenses Error:', err);
    res.status(500).json({ message: 'Failed to fetch expenses' });
  }
});

router.get('/settlement/:roomId', auth, calculateSettlement);


module.exports = router;
