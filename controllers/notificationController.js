const Notification = require('../models/Notification');

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

module.exports = { getUserNotification };

