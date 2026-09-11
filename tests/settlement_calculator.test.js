const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeBalances, computeSettlements } = require('../utils/settlementCalculator');

describe('Settlement Calculator Unit Tests', () => {
  const userA = { _id: 'userA_id', name: 'Alice' };
  const userB = { _id: 'userB_id', name: 'Bob' };
  const userC = { _id: 'userC_id', name: 'Charlie' };
  const members = [userA, userB, userC];

  it('should calculate balances when User A pays 900 split 3 ways', () => {
    const expenses = [
      { amount: 900, addedBy: 'userA_id' },
    ];
    const balances = computeBalances(members, expenses, []);

    // Share = 300 each.
    // User A: +900 - 300 = +600
    // User B: -300
    // User C: -300
    assert.equal(balances['userA_id'].balance, 600);
    assert.equal(balances['userB_id'].balance, -300);
    assert.equal(balances['userC_id'].balance, -300);

    const settlements = computeSettlements(members, expenses, []);
    assert.equal(settlements.length, 2);
    // Bob owes Alice 300
    // Charlie owes Alice 300
    assert.deepEqual(settlements, [
      { from: { _id: 'userB_id', name: 'Bob' }, to: { _id: 'userA_id', name: 'Alice' }, amount: 300 },
      { from: { _id: 'userC_id', name: 'Charlie' }, to: { _id: 'userA_id', name: 'Alice' }, amount: 300 },
    ]);
  });

  it('should account for approved settlement requests', () => {
    const expenses = [
      { amount: 900, addedBy: 'userA_id' },
    ];
    // Bob paid 200 to Alice previously and it was approved
    const approvedSettlements = [
      { from: 'userB_id', to: 'userA_id', amount: 200 },
    ];

    const balances = computeBalances(members, expenses, approvedSettlements);
    // User A: 600 - 200 = 400
    // User B: -300 + 200 = -100
    // User C: -300
    assert.equal(balances['userA_id'].balance, 400);
    assert.equal(balances['userB_id'].balance, -100);
    assert.equal(balances['userC_id'].balance, -300);

    const settlements = computeSettlements(members, expenses, approvedSettlements);
    assert.equal(settlements.length, 2);
    assert.deepEqual(settlements, [
      { from: { _id: 'userB_id', name: 'Bob' }, to: { _id: 'userA_id', name: 'Alice' }, amount: 100 },
      { from: { _id: 'userC_id', name: 'Charlie' }, to: { _id: 'userA_id', name: 'Alice' }, amount: 300 },
    ]);
  });

  it('should handle zero balances and empty expenses cleanly', () => {
    const balances = computeBalances(members, [], []);
    assert.equal(balances['userA_id'].balance, 0);
    assert.equal(balances['userB_id'].balance, 0);
    assert.equal(balances['userC_id'].balance, 0);

    const settlements = computeSettlements(members, [], []);
    assert.deepEqual(settlements, []);
  });

  it('should handle decimal money amounts accurately', () => {
    const expenses = [
      { amount: 100, addedBy: 'userA_id' },
    ];
    const settlements = computeSettlements(members, expenses, []);
    // 100 / 3 = 33.333333333333336
    // Alice balance: +66.6666...
    // Bob balance: -33.3333...
    // Charlie balance: -33.3333...
    assert.equal(settlements.length, 2);
    assert.equal(settlements[0].amount, 33.33);
    assert.equal(settlements[1].amount, 33.33);
  });
});
