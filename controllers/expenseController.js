const Expense = require("../models/Expense");
const Room = require("../models/Room");
const SettlementRequest = require("../models/SettlementRequest"); // Make sure this is imported

exports.calculateSettlement = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Fetch room and all members
    const room = await Room.findById(roomId).populate("members", "_id name");
    if (!room) return res.status(404).json({ message: "Room not found" });

    const expenses = await Expense.find({ room: roomId });

    const balances = {};
    const memberCount = room.members.length;

    // Initialize balances
    room.members.forEach((member) => {
      balances[member._id.toString()] = { name: member.name, balance: 0 };
    });

    // Process each expense
    for (let expense of expenses) {
      const share = expense.amount / memberCount;
      const paidBy = expense.addedBy.toString();

      room.members.forEach((member) => {
        const memberId = member._id.toString();
        if (memberId === paidBy) {
          balances[memberId].balance += expense.amount - share;
        } else {
          balances[memberId].balance -= share;
        }
      });
    }

    // ✅ Apply previously approved settlements
    const approved = await SettlementRequest.find({ room: roomId, status: 'approved' });
    for (let s of approved) {
      const fromId = s.from.toString();
      const toId = s.to.toString();
      if (balances[fromId] && balances[toId]) {
        balances[fromId].balance += s.amount;
        balances[toId].balance -= s.amount;
      }
    }

    // Prepare settlement transactions
    const settlements = [];
    const debtors = Object.entries(balances).filter(
      ([_, v]) => v.balance < -0.01
    );
    const creditors = Object.entries(balances).filter(
      ([_, v]) => v.balance > 0.01
    );

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const [debtorId, debtor] = debtors[i];
      const [creditorId, creditor] = creditors[j];

      const amount = Math.min(-debtor.balance, creditor.balance);
      settlements.push({
        from: { _id: debtorId, name: debtor.name },
        to: { _id: creditorId, name: creditor.name },
        amount: parseFloat(amount.toFixed(2)),
      });

      debtor.balance += amount;
      creditor.balance -= amount;

      if (debtor.balance >= -0.01) i++;
      if (creditor.balance <= 0.01) j++;
    }

    res.status(200).json({ settlements });

  } catch (err) {
    console.error("Error calculating settlements:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
