const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Room = require('../models/Room');
const auth = require('../middlewares/auth');
const { calculateSettlement } = require('../controllers/expenseController');
const Notification = require('../models/Notification');

//Add expense

router.post('/:roomId/add', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, amount, description } = req.body;

    const room = await Room.findById(roomId).populate('members', '_id');
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

    // Prepare notification receivers (exclude sender)
    const receivers = room.members
      .filter((member) => member._id.toString() !== req.user.id.toString())
      .map((member) => member._id);

    if (receivers.length > 0) {
      await Notification.create({
        sender: req.user.id,
        receivers,
        roomId,
        type: 'expense-added',
        message: `New expense "${title}" of ₹${amount} was added.`,
      });
      console.log('✅ Notification sent to:', receivers);
    }

    const createdNotification = await Notification.create({
  sender: req.user.id,
  receivers,
  roomId,
  type: 'expense-added',
  message: `New expense "${title}" of ₹${amount} was added.`,
});

console.log('🧾 Notification saved to DB:', createdNotification);

    res.status(201).json({ message: 'Expense added successfully', expense });

  } catch (err) {
    console.error('Add Expense Error:', err.message, err);
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

// Delete an expense (only by the user who added it)
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Check if the logged-in user is the one who added the expense
    if (expense.addedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this expense' });
    }

    await expense.deleteOne();
    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Delete Expense Error:', err);
    res.status(500).json({ message: 'Failed to delete expense' });
  }
});



module.exports = router;
