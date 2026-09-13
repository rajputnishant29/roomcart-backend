const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middlewares/auth');
const sendMail = require('../utils/sendMail');
const { deleteUserAccount } = require('../services/accountDeletionService');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, avatar } = req.body;

  console.log("📥 Incoming registration request:", { name, email, avatar });

  if (!email || !name || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new User({ 
      name, 
      email, 
      password: hashedPassword,
      ...(avatar ? { avatar } : {})
    });
    await user.save();

    // Never await sendMail so slow/failing SMTP never breaks registration
  sendMail({
  to: email,
  subject: '🎉 Welcome to OweZone!',
  html: `
    <div style="
      margin: 0;
      padding: 40px 20px;
      background: #f7f5ff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #29263a;
    ">
      <div style="
        max-width: 560px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 12px 40px rgba(91, 72, 150, 0.10);
      ">

        <!-- Header -->
        <div style="
          padding: 42px 36px 36px;
          text-align: center;
          background: linear-gradient(135deg, #eee9ff 0%, #f9f7ff 100%);
        ">
          <div style="
            display: inline-block;
            padding: 10px 16px;
            background: #ffffff;
            border-radius: 14px;
            color: #7657d9;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
            margin-bottom: 22px;
          ">
            OweZone
          </div>

          <h1 style="
            margin: 0;
            color: #29263a;
            font-size: 30px;
            line-height: 1.2;
            font-weight: 750;
            letter-spacing: -0.8px;
          ">
            Welcome to OweZone! 🎉
          </h1>

          <p style="
            margin: 14px 0 0;
            color: #716d82;
            font-size: 16px;
            line-height: 1.6;
          ">
            A smarter way to keep group expenses simple.
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 38px 36px 42px;">

          <p style="
            margin: 0 0 18px;
            font-size: 17px;
            line-height: 1.7;
            color: #383447;
          ">
            Hi <strong>${name}</strong>,
          </p>

          <p style="
            margin: 0 0 20px;
            font-size: 16px;
            line-height: 1.7;
            color: #656174;
          ">
            Thanks for joining <strong style="color: #7657d9;">OweZone</strong>.
            We're excited to have you here.
          </p>

          <p style="
            margin: 0 0 28px;
            font-size: 16px;
            line-height: 1.7;
            color: #656174;
          ">
            Whether you're splitting bills with roommates, planning a trip
            with friends, or keeping track of shared expenses, OweZone is
            built to make it easier.
          </p>

          <!-- Feature Card -->
          <div style="
            margin-bottom: 30px;
            padding: 22px;
            background: #f8f6ff;
            border: 1px solid #eee9ff;
            border-radius: 18px;
          ">
            <p style="
              margin: 0 0 8px;
              font-size: 15px;
              font-weight: 700;
              color: #7657d9;
            ">
              ✨ What's next?
            </p>

            <p style="
              margin: 0;
              font-size: 15px;
              line-height: 1.6;
              color: #656174;
            ">
              Keep an eye out for new features, improvements, and useful
              tips as we continue building OweZone.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align: center; margin: 34px 0;">
            <a
              href="https://owezone.rajputnishant.in"
              style="
                display: inline-block;
                padding: 15px 28px;
                background: linear-gradient(135deg, #7657d9, #9274e8);
                color: #ffffff;
                text-decoration: none;
                border-radius: 14px;
                font-size: 15px;
                font-weight: 700;
                box-shadow: 0 8px 20px rgba(118, 87, 217, 0.22);
              "
            >
              Open OweZone →
            </a>
          </div>

          <p style="
            margin: 0 0 20px;
            font-size: 15px;
            line-height: 1.7;
            color: #716d82;
            text-align: center;
          ">
            Have feedback or ideas?
            <strong style="color: #383447;">
              We'd love to hear them.
            </strong>
          </p>

          <div style="
            height: 1px;
            background: #eeeef3;
            margin: 30px 0;
          "></div>

          <p style="
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
            color: #8b8798;
            text-align: center;
          ">
            Thanks for being part of the OweZone journey.
          </p>

          <p style="
            margin: 8px 0 0;
            font-size: 14px;
            font-weight: 700;
            color: #383447;
            text-align: center;
          ">
            — The OweZone Team
          </p>

        </div>
      </div>

      <!-- Footer -->
      <p style="
        max-width: 560px;
        margin: 22px auto 0;
        text-align: center;
        font-size: 12px;
        line-height: 1.5;
        color: #9b97a8;
      ">
        © ${new Date().getFullYear()} OweZone · Making shared expenses easier.
      </p>
    </div>
  `,
  }).catch(err => {
      console.error('⚠️ Welcome email failed to send in background:', err.message);
    });

    // ✅ Generate JWT token immediately so user is logged in
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Return token and user data (consistent with /login)
    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
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

// DELETE /api/auth/me
router.delete('/me', auth, async (req, res) => {
  try {
    const result = await deleteUserAccount(req.user.id);
    if (result.notFound) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully.',
    });
  } catch (err) {
    console.error('Delete Account Error:', err.message);
    return res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;
