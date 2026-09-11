const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: String,
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

expenseSchema.index({ room: 1 });
expenseSchema.index({ addedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
