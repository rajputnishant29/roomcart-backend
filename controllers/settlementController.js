const SettlementRequest = require('../models/SettlementRequest');
const mongoose = require('mongoose');

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
    res.status(201).json({ message: 'Marked as paid. Awaiting confirmation.' });
  } catch (error) {
    console.error('Settlement creation error:', error.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
};


// Approve settlement
exports.approveSettlement = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id; // ✅ FIXED: use 'id' instead of '_id'

  try {
    const request = await SettlementRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (request.to.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the receiver can approve this' });
    }

    request.status = 'approved';
    await request.save();

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

