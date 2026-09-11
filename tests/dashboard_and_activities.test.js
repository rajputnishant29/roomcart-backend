const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Models
const Room = require('../models/Room');
const Expense = require('../models/Expense');
const SettlementRequest = require('../models/SettlementRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');

const {
  getDashboardSummary,
  getDashboardActivities,
} = require('../controllers/dashboardController');
const { getRoomActivities } = require('../controllers/roomController');
const { calculateSettlement } = require('../controllers/expenseController');

// Helper to create mock req and res
function mockReqRes(options = {}) {
  const req = {
    user: options.user || { id: new mongoose.Types.ObjectId().toString() },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    app: {
      get: () => ({ emit: () => {} }),
    },
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };

  return { req, res };
}

describe('Dashboard and Room Activity Controller Integration Tests', () => {
  const userIdA = new mongoose.Types.ObjectId().toString();
  const userIdB = new mongoose.Types.ObjectId().toString();
  const userIdC = new mongoose.Types.ObjectId().toString();

  const userA = { _id: new mongoose.Types.ObjectId(userIdA), name: 'User A' };
  const userB = { _id: new mongoose.Types.ObjectId(userIdB), name: 'User B' };
  const userC = { _id: new mongoose.Types.ObjectId(userIdC), name: 'User C' };

  const roomId1 = new mongoose.Types.ObjectId().toString();
  const roomId2 = new mongoose.Types.ObjectId().toString();

  // Mock rooms
  const room1 = {
    _id: new mongoose.Types.ObjectId(roomId1),
    name: 'Room 1',
    admin: userA._id,
    members: [userA, userB],
  };

  const room2 = {
    _id: new mongoose.Types.ObjectId(roomId2),
    name: 'Room 2',
    admin: userA._id,
    members: [userA, userC],
  };

  // Helper dates
  const now = new Date();
  const thisMonthDate1 = new Date(now.getFullYear(), now.getMonth(), 2, 12, 0, 0);
  const thisMonthDate2 = new Date(now.getFullYear(), now.getMonth(), 5, 14, 0, 0);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 10, 0, 0);
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 15, 10, 0, 0);

  it('1. THIS MONTH EXPENDITURE: User A paid ₹1000 this month, ₹500 last month, ₹300 next month, User B paid ₹400 this month', async () => {
    // Stub Room.find
    const origRoomFind = Room.find;
    const origExpenseFind = Expense.find;
    const origSettlementFind = SettlementRequest.find;
    const origNotificationFind = Notification.find;

    try {
      Room.find = () => ({
        populate: () => Promise.resolve([room1]),
      });

      Expense.find = () =>
        Promise.resolve([
          // User A paid 1000 this month -> Included
          { room: roomId1, amount: 1000, addedBy: userA._id, createdAt: thisMonthDate1 },
          // User A paid 500 last month -> Excluded
          { room: roomId1, amount: 500, addedBy: userA._id, createdAt: prevMonthDate },
          // User A paid 300 next month -> Excluded
          { room: roomId1, amount: 300, addedBy: userA._id, createdAt: nextMonthDate },
          // User B paid 400 this month (User A participated but didn't pay) -> Excluded from User A expenditure
          { room: roomId1, amount: 400, addedBy: userB._id, createdAt: thisMonthDate2 },
        ]);

      SettlementRequest.find = () => Promise.resolve([]);
      Notification.find = () => ({
        sort: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const { req, res } = mockReqRes({ user: { id: userIdA } });
      await getDashboardSummary(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.thisMonthExpenditure, 1000);
    } finally {
      Room.find = origRoomFind;
      Expense.find = origExpenseFind;
      SettlementRequest.find = origSettlementFind;
      Notification.find = origNotificationFind;
    }
  });

  it("2. YOU'RE OWED & YOU OWE across multiple rooms with partial settlements", async () => {
    // Room 1: members A and B. User A paid 1000 (each share 500). User B owes User A 500.
    // Approved settlement in Room 1: User B paid User A 200. Outstanding: User B owes User A 300.
    // Room 2: members A and C. User C paid 800 (each share 400). User A owes User C 400.
    // Dashboard for User A:
    // You're Owed = 300 (from B in Room 1)
    // You Owe = 400 (to C in Room 2)

    const origRoomFind = Room.find;
    const origExpenseFind = Expense.find;
    const origSettlementFind = SettlementRequest.find;
    const origNotificationFind = Notification.find;

    try {
      Room.find = () => ({
        populate: () => Promise.resolve([room1, room2]),
      });

      Expense.find = () =>
        Promise.resolve([
          { room: roomId1, amount: 1000, addedBy: userA._id, createdAt: thisMonthDate1 },
          { room: roomId2, amount: 800, addedBy: userC._id, createdAt: thisMonthDate2 },
        ]);

      SettlementRequest.find = () =>
        Promise.resolve([
          { room: roomId1, from: userB._id, to: userA._id, amount: 200, status: 'approved' },
        ]);

      Notification.find = () => ({
        sort: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      const { req, res } = mockReqRes({ user: { id: userIdA } });
      await getDashboardSummary(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.youreOwed, 300);
      assert.equal(res.data.youOwe, 400);
    } finally {
      Room.find = origRoomFind;
      Expense.find = origExpenseFind;
      SettlementRequest.find = origSettlementFind;
      Notification.find = origNotificationFind;
    }
  });

  it('3. ZERO DATA CASES: returns 0 and empty arrays when user has no rooms / no activity', async () => {
    const origRoomFind = Room.find;

    try {
      Room.find = () => ({
        populate: () => Promise.resolve([]),
      });

      const { req, res } = mockReqRes({ user: { id: userIdA } });
      await getDashboardSummary(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.data, {
        thisMonthExpenditure: 0,
        youreOwed: 0,
        youOwe: 0,
        recentActivities: [],
      });
    } finally {
      Room.find = origRoomFind;
    }
  });

  it('4. ROOM ACTIVITIES: member can fetch activities, sorted newest first, limit respected', async () => {
    const origRoomFindById = Room.findById;
    const origNotificationFind = Notification.find;

    const mockNotifications = [
      {
        _id: new mongoose.Types.ObjectId(),
        roomId: room1._id,
        type: 'expense-added',
        sender: { _id: userA._id, name: 'User A', avatar: 'avatar_01.jpg' },
        message: 'New expense added',
        createdAt: new Date('2026-09-10T12:00:00Z'),
      },
      {
        _id: new mongoose.Types.ObjectId(),
        roomId: room1._id,
        type: 'joined',
        sender: { _id: userB._id, name: 'User B', avatar: 'avatar_02.jpg' },
        message: 'User B joined',
        createdAt: new Date('2026-09-08T10:00:00Z'),
      },
    ];

    try {
      Room.findById = () => Promise.resolve(room1);

      Notification.find = (filter) => ({
        sort: () => ({
          limit: (lim) => ({
            populate: () => Promise.resolve(mockNotifications.slice(0, lim)),
          }),
        }),
      });

      const { req, res } = mockReqRes({
        user: { id: userIdA },
        params: { roomId: roomId1 },
        query: { limit: '1' },
      });

      await getRoomActivities(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.activities.length, 1);
      assert.equal(res.data.activities[0].type, 'expense-added');
      assert.equal(res.data.activities[0].actor.name, 'User A');
    } finally {
      Room.findById = origRoomFindById;
      Notification.find = origNotificationFind;
    }
  });

  it('5. ROOM ACTIVITIES: unauthorized user gets 403 Forbidden', async () => {
    const origRoomFindById = Room.findById;
    const outsiderId = new mongoose.Types.ObjectId().toString();

    try {
      Room.findById = () => Promise.resolve(room1); // room1 has members userA, userB

      const { req, res } = mockReqRes({
        user: { id: outsiderId },
        params: { roomId: roomId1 },
      });

      await getRoomActivities(req, res);

      assert.equal(res.statusCode, 403);
      assert.equal(res.data.message, 'You are not authorized to view activities for this room');
    } finally {
      Room.findById = origRoomFindById;
    }
  });

  it('6. ROOM ACTIVITIES: non-existent room gets 404 Not Found', async () => {
    const origRoomFindById = Room.findById;

    try {
      Room.findById = () => Promise.resolve(null);

      const { req, res } = mockReqRes({
        user: { id: userIdA },
        params: { roomId: roomId1 },
      });

      await getRoomActivities(req, res);

      assert.equal(res.statusCode, 404);
      assert.equal(res.data.message, 'Room not found');
    } finally {
      Room.findById = origRoomFindById;
    }
  });

  it('7. EXISTING calculateSettlement: maintains 100% backward compatibility', async () => {
    const origRoomFindById = Room.findById;
    const origExpenseFind = Expense.find;
    const origSettlementFind = SettlementRequest.find;

    try {
      Room.findById = () => ({
        populate: () => Promise.resolve(room1),
      });

      Expense.find = () =>
        Promise.resolve([
          { room: roomId1, amount: 600, addedBy: userA._id },
        ]);

      SettlementRequest.find = () => Promise.resolve([]);

      const { req, res } = mockReqRes({
        user: { id: userIdA },
        params: { roomId: roomId1 },
      });

      await calculateSettlement(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.data.settlements, [
        {
          from: { _id: userIdB, name: 'User B' },
          to: { _id: userIdA, name: 'User A' },
          amount: 300,
        },
      ]);
    } finally {
      Room.findById = origRoomFindById;
      Expense.find = origExpenseFind;
      SettlementRequest.find = origSettlementFind;
    }
  });
});
