const mongoose = require('mongoose');
const Room = require('../models/Room');
const Expense = require('../models/Expense');
const SettlementRequest = require('../models/SettlementRequest');
const Notification = require('../models/Notification');
const { computeSettlements } = require('../utils/settlementCalculator');

/**
 * GET /api/dashboard/summary
 * Returns:
 * - thisMonthExpenditure: Total amount paid by the user in the current calendar month across their rooms
 * - youreOwed: Total net amount other users owe to the authenticated user across all their rooms
 * - youOwe: Total net amount the authenticated user owes to other users across all their rooms
 * - recentActivities: Recent activities across all rooms the user belongs to
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();

    // 1. Fetch all rooms the user belongs to (admin or member)
    const rooms = await Room.find({
      $or: [
        { admin: userId },
        { members: userId }
      ]
    }).populate('members', '_id name');

    if (!rooms || rooms.length === 0) {
      return res.status(200).json({
        thisMonthExpenditure: 0,
        youreOwed: 0,
        youOwe: 0,
        recentActivities: [],
      });
    }

    const roomIds = rooms.map(r => r._id);

    // 2. Calculate current calendar month boundary in local time
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    // 3. Query all expenses and approved settlements for user's rooms
    const [expenses, approvedSettlements] = await Promise.all([
      Expense.find({ room: { $in: roomIds } }),
      SettlementRequest.find({ room: { $in: roomIds }, status: 'approved' })
    ]);

    // 4. Calculate this month total expenditure (expenses where user is payer in current month)
    let thisMonthExpenditure = 0;
    for (const exp of expenses) {
      const payerId = (exp.addedBy?._id || exp.addedBy || '').toString();
      if (payerId === userId) {
        const expDate = new Date(exp.createdAt);
        if (expDate >= startOfMonth && expDate < startOfNextMonth) {
          thisMonthExpenditure += exp.amount || 0;
        }
      }
    }

    // 5. Group expenses and approved settlements by room
    const expensesByRoom = {};
    for (const exp of expenses) {
      const rId = (exp.room?._id || exp.room).toString();
      if (!expensesByRoom[rId]) expensesByRoom[rId] = [];
      expensesByRoom[rId].push(exp);
    }

    const settlementsByRoom = {};
    for (const s of approvedSettlements) {
      const rId = (s.room?._id || s.room).toString();
      if (!settlementsByRoom[rId]) settlementsByRoom[rId] = [];
      settlementsByRoom[rId].push(s);
    }

    // 6. Calculate total owed to user and total user owes across all rooms
    let youreOwed = 0;
    let youOwe = 0;

    for (const room of rooms) {
      const rId = room._id.toString();
      const roomExpenses = expensesByRoom[rId] || [];
      const roomApproved = settlementsByRoom[rId] || [];

      const settlements = computeSettlements(room.members, roomExpenses, roomApproved);

      for (const st of settlements) {
        const toId = (st.to?._id || st.to || '').toString();
        const fromId = (st.from?._id || st.from || '').toString();

        if (toId === userId) {
          youreOwed += st.amount;
        }
        if (fromId === userId) {
          youOwe += st.amount;
        }
      }
    }

    // 7. Fetch recent activities across user's rooms
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const notifications = await Notification.find({ roomId: { $in: roomIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', '_id name avatar')
      .populate('roomId', '_id name');

    const recentActivities = notifications.map(act => ({
      id: act._id,
      type: act.type,
      actor: {
        id: act.sender?._id || null,
        name: act.sender?.name || 'Unknown',
        avatar: act.sender?.avatar || null,
      },
      roomId: act.roomId?._id || act.roomId,
      roomName: act.roomId?.name || '',
      message: act.message || '',
      createdAt: act.createdAt,
    }));

    res.status(200).json({
      thisMonthExpenditure: parseFloat(thisMonthExpenditure.toFixed(2)),
      youreOwed: parseFloat(youreOwed.toFixed(2)),
      youOwe: parseFloat(youOwe.toFixed(2)),
      recentActivities,
    });
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/dashboard/activities
 * Returns recent activities across all rooms the user is a member of.
 */
exports.getDashboardActivities = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();

    const rooms = await Room.find({
      $or: [
        { admin: userId },
        { members: userId }
      ]
    }).select('_id');

    if (!rooms || rooms.length === 0) {
      return res.status(200).json({ activities: [] });
    }

    const roomIds = rooms.map(r => r._id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    const notifications = await Notification.find({ roomId: { $in: roomIds } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', '_id name avatar')
      .populate('roomId', '_id name');

    const activities = notifications.map(act => ({
      id: act._id,
      type: act.type,
      actor: {
        id: act.sender?._id || null,
        name: act.sender?.name || 'Unknown',
        avatar: act.sender?.avatar || null,
      },
      roomId: act.roomId?._id || act.roomId,
      roomName: act.roomId?.name || '',
      message: act.message || '',
      createdAt: act.createdAt,
    }));

    res.status(200).json({ activities });
  } catch (error) {
    console.error('Error in getDashboardActivities:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
