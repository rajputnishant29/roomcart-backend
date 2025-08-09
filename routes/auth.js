const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middlewares/auth');
const sendMail = require('../utils/sendMail');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  console.log("📥 Incoming registration request:", { name, email, password });

  if (!email || !name || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword });
    await user.save();

    console.log("✅ User saved successfully");
    console.log("📨 Attempting to send mail to:", email);

    await sendMail({
      to: email,
      subject: '🎉 Welcome to OweZone!',
      html: `
       <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <h2 style="color: #2b2b2b;">Hi ${name},</h2>
      <p>Thanks for being part of <strong>OweZone</strong> – we’re thrilled to have you onboard! 🎉</p>
      <p>We hope you’re enjoying a smarter way to track group expenses. This is just the beginning, and we’re working hard to bring you even more features and improvements.</p>
      <p>✨ <strong>Stay tuned for app updates, tips, and new features</strong> coming your way soon.</p>
      <p>💬 We’d love to hear from you – your feedback helps shape the future of OweZone.</p>
      <p>
        <a href="https://owezone-web.netlify.app" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Visit OweZone</a>
      </p>
      <p>Thank you for being with us.</p>
      <p>– The OweZone Team</p>
    </div>
      `,
    });

    res.status(201).json({ message: 'User registered and welcome email sent' });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id; // ✅ Extract the actual ID
    const user = await User.findById(userId).select('-password');
    res.json(user);
  } catch (err) {
    console.error('Get Profile Error:', err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/update-avatar
router.put('/update-avatar', auth, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ message: 'Avatar is required' });

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar },
      { new: true }
    ).select('-password');
    res.json({ message: 'Avatar updated', avatar: user.avatar });
  } catch (err) {
    console.error('Update Avatar Error:', err);
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});



module.exports = router;
