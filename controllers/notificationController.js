const Notification = require('../models/Notification');
const User = require('../models/User');

const getUserNotification = async (req, res) => {
  const userId = req.user._id || req.user.id;

  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      limit = 15;
    } else if (limit > 50) {
      limit = 50;
    }

    const skip = (page - 1) * limit;
    const filter = { receivers: userId };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'name')
        .populate('roomId', 'name'),
      Notification.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('Get Notifications Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const registerDevice = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { token, platform } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ message: 'Device token is required' });
    }

    const trimmedToken = token.trim();
    const normalizedPlatform = (typeof platform === 'string' && platform.trim())
      ? platform.trim().toLowerCase()
      : 'android';

    const user = await User.findById(userId).select('+pushyDevices');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!Array.isArray(user.pushyDevices)) {
      user.pushyDevices = [];
    }

    const existingIndex = user.pushyDevices.findIndex((d) => d.token === trimmedToken);
    if (existingIndex !== -1) {
      user.pushyDevices[existingIndex].updatedAt = new Date();
      if (platform) {
        user.pushyDevices[existingIndex].platform = normalizedPlatform;
      }
    } else {
      user.pushyDevices.push({
        token: trimmedToken,
        platform: normalizedPlatform,
        updatedAt: new Date(),
      });
    }

    await user.save();

    return res.status(200).json({
      message: 'Push notification device registered successfully',
    });
  } catch (err) {
    console.error('Register Device Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const unregisterDevice = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ message: 'Device token is required' });
    }

    const trimmedToken = token.trim();

    await User.updateOne(
      { _id: userId },
      { $pull: { pushyDevices: { token: trimmedToken } } }
    );

    return res.status(200).json({
      message: 'Device unregistered successfully',
    });
  } catch (err) {
    console.error('Unregister Device Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserNotification,
  registerDevice,
  unregisterDevice,
};


