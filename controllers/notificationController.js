const Notification = require('../models/Notification');

const getUserNotification = async (req, res) => {
  const userId = req.user.id;

  try {
    const notifications = await Notification.find({
      receivers: userId,
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'name') // so you get sender's name
      .populate('roomId', 'name'); // optional

    res.status(200).json({ notifications });
  } catch (err) {
    console.error('Get Notifications Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getUserNotification };
