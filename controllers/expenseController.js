const Expense = require("../models/Expense");
const Room = require("../models/Room");
const SettlementRequest = require("../models/SettlementRequest");
const { computeSettlements } = require("../utils/settlementCalculator");

exports.calculateSettlement = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Fetch room and all members
    const room = await Room.findById(roomId).populate("members", "_id name");
    if (!room) return res.status(404).json({ message: "Room not found" });

    const expenses = await Expense.find({ room: roomId });
    const approved = await SettlementRequest.find({ room: roomId, status: 'approved' });

    const settlements = computeSettlements(room.members, expenses, approved);

    res.status(200).json({ settlements });

  } catch (err) {
    console.error("Error calculating settlements:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
