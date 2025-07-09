const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: 'http://192.168.31.11:5000/avatar_01.jpg',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
