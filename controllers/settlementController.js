const SettlementRequest = require('../models/SettlementRequest');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { sendPushToUsers } = require('../services/pushyService');

// Create settlement request
exports.markAsPaidRequest = async (req, res) => {
  const { from, to, amount, roomId } = req.body;

  if (!roomId || !from || !to || !amount) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existing = await SettlementRequest.findOne({
      from: new mongoose.Types.ObjectId(from),
      to: new mongoose.Types.ObjectId(to),
      room: new mongoose.Types.ObjectId(roomId),
      status: 'pending',
    });

    if (existing) return res.status(400).json({ message: 'Request already pending.' });

    const request = new SettlementRequest({
      from: new mongoose.Types.ObjectId(from),
      to: new mongoose.Types.ObjectId(to),
      amount,
      room: new mongoose.Types.ObjectId(roomId),
    });

    await request.save();

    const notification = await Notification.create({
      sender: from,
      receivers: [to],
      roomId: roomId,
      type: 'settlement-request',
      message: `You have a new settlement request of ₹${amount}.`,
    });

    // Send push notification to recipient
    sendPushToUsers({
      userIds: [to],
      title: 'Settlement request',
      message: notification.message,
      data: {
        type: 'settlement-request',
        notificationId: notification._id.toString(),
        roomId: roomId.toString(),
        settlementId: request._id.toString(),
      },
    }).catch((pushErr) => {
      console.error('❌ Push delivery error on settlement-request:', pushErr.message);
    });

    res.status(201).json({ message: 'Marked as paid. Awaiting confirmation.' });
  } catch (error) {
    console.error('Settlement creation error:', error.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
};


// Approve settlement
exports.approveSettlement = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;

  try {
    const request = await SettlementRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the receiver can approve this' });
    }

    request.status = 'approved';
    await request.save();

    const notification = await Notification.create({
      sender: userId,
      receivers: [request.from],
      roomId: request.room,
      type: 'settlement-approved',
      message: `Your settlement request of ₹${request.amount} has been approved.`,
    });

    // Send push notification to requester
    sendPushToUsers({
      userIds: [request.from],
      title: 'Settlement approved',
      message: notification.message,
      data: {
        type: 'settlement-approved',
        notificationId: notification._id.toString(),
        roomId: request.room.toString(),
        settlementId: request._id.toString(),
      },
    }).catch((pushErr) => {
      console.error('❌ Push delivery error on settlement-approved:', pushErr.message);
    });

    res.status(200).json({ message: 'Settlement approved' });
  } catch (error) {
    console.error('Error approving settlement:', error.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
};


exports.getMySettlementRequests = async (req, res) => {
  const userId = req.user._id || req.user.id;
  try {
    const requests = await SettlementRequest.find({
      to: new mongoose.Types.ObjectId(userId),
      status: 'pending',
    })
      .populate('from', 'name')
      .populate('room', 'name');

    res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching settlement requests:', error.message);
    res.status(500).json({ message: 'Failed to fetch settlement requests' });
  }
};

