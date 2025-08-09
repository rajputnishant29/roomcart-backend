const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sendMail = require('../utils/sendMail');

const router = express.Router();

/**
 * @route   POST /api/forgot-password
 * @desc    Send OTP to user's email for password reset
 */
router.post('/', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before saving (security)
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetPasswordToken = hashedOtp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP email
    await sendMail({
      to: user.email,
      subject: 'OweZone Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>Your OTP code is:</p>
          <h1 style="letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn’t request this, just ignore this email.</p>
          <p>— OweZone Team</p>
        </div>
      `,
    });

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/forgot-password/reset
 * @desc    Verify OTP and reset password
 */
router.post('/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword)
    return res.status(400).json({ message: 'All fields are required' });

  try {
    const user = await User.findOne({
      email,
      resetPasswordExpires: { $gt: Date.now() }, // Check expiry
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired OTP' });

    // Compare entered OTP with hashed OTP in DB
    const isMatch = await bcrypt.compare(otp, user.resetPasswordToken);
    if (!isMatch) return res.status(400).json({ message: 'Invalid OTP' });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear OTP fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
