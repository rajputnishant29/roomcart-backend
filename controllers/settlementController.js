const SettlementRequest = require('../models/SettlementRequest');
const mongoose = require('mongoose');

// Create settlement request
exports.markAsPaidRequest = async (req, res) => {
  const { from, to, amount, roomId } = req.body;

  const existing = await SettlementRequest.findOne({ from, to, room: roomId, status: 'pending' });
  if (existing) return res.status(400).json({ message: 'Request already pending.' });

  if (!roomId) return res.status(400).json({ message: "Room ID is required" });

const request = new SettlementRequest({
  from,
  to,
  amount,
  room: mongoose.Types.ObjectId(roomId), // cast it if needed
});

  await request.save();
  res.status(201).json({ message: 'Marked as paid. Awaiting confirmation.' });
};

// Approve settlement
exports.approveSettlement = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user._id;

  const request = await SettlementRequest.findById(requestId);
  if (!request) return res.status(404).json({ message: 'Request not found' });

  if (request.to.toString() !== userId.toString())
    return res.status(403).json({ message: 'Only the receiver can approve this' });

  request.status = 'approved';
  await request.save();

  res.status(200).json({ message: 'Settlement approved' });
};

exports.getMySettlementRequests = async (req, res) => {
  const userId = req.user._id;
  try {
    const requests = await SettlementRequest.find({
      to: userId,
      status: 'pending',
    }).populate('from', 'name').populate('room', 'name');
    
    res.status(200).json({ requests });
  } catch (error) {
    console.error('Error fetching settlement requests:', error.message);
    res.status(500).json({ message: 'Failed to fetch settlement requests' });
  }
};