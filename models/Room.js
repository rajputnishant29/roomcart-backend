const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  roomCode: {
    type: String,
    unique: true,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  themeColor: {
    type: String,
    required: true,
    default: '#4a90e2',
  },
  size: {
    type: String,
    enum: ['Mini', 'Mid', 'Giant'],
    required: true,
    default: 'Mid',
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  avatar: {
    type: String, 
    // required: true,
    default: 'http://192.168.31.11:5000/avatar_01.jpg'
  },
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
