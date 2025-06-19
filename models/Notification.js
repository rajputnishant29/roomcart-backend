const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    receivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    message: String,
    type: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
