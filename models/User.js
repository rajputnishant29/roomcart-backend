const mongoose = require('mongoose');
const BASE_URL = process.env.BASE_URL;

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
    // default: `${BASE_URL}/avatar_01.jpg`,
    default: `${BASE_URL}/avatar_01.jpg`,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  pushyDevices: {
    type: [
      {
        token: {
          type: String,
          required: true,
          trim: true,
        },
        platform: {
          type: String,
          default: 'android',
          trim: true,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
    select: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
