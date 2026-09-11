/**
 * Calculate member balances and settlement transactions.
 * Extracted from production expenseController logic to serve as a shared,
 * single source of truth for both room-level settlements and global dashboard calculations.
 */

function computeBalances(members = [], expenses = [], approvedSettlements = []) {
  const balances = {};
  const memberCount = members.length;
  if (memberCount === 0) return balances;

  // Initialize balances
  members.forEach((member) => {
    const memberId = (member._id || member).toString();
    const memberName = member.name || '';
    balances[memberId] = { name: memberName, balance: 0 };
  });

  // Process each expense
  for (let expense of expenses) {
    if (!expense || typeof expense.amount !== 'number') continue;
    const share = expense.amount / memberCount;
    const paidBy = (expense.addedBy?._id || expense.addedBy || '').toString();

    members.forEach((member) => {
      const memberId = (member._id || member).toString();
      if (balances[memberId]) {
        if (memberId === paidBy) {
          balances[memberId].balance += expense.amount - share;
        } else {
          balances[memberId].balance -= share;
        }
      }
    });
  }

  // Apply previously approved settlements
  for (let s of approvedSettlements) {
    if (!s || typeof s.amount !== 'number') continue;
    const fromId = (s.from?._id || s.from || '').toString();
    const toId = (s.to?._id || s.to || '').toString();

    if (balances[fromId] && balances[toId]) {
      balances[fromId].balance += s.amount;
      balances[toId].balance -= s.amount;
    }
  }

  return balances;
}

function computeSettlements(members = [], expenses = [], approvedSettlements = []) {
  const balances = computeBalances(members, expenses, approvedSettlements);

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

  return settlements;
}

module.exports = {
  computeBalances,
  computeSettlements,
};
