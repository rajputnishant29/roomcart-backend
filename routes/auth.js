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

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ name, email, password: hashedPassword });
    await user.save();

    // ✅ Send Welcome Email
    await sendMail({
      to: email,
      subject: '🎉 Welcome to OweZone!',
      html: `
        <h2>Hello ${name},</h2>
        <p>Welcome to <strong>OweZone</strong>! 🎉</p>
        <p>Your journey to smarter group expense tracking starts now.</p>
        <p>– Team OweZone</p>
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
