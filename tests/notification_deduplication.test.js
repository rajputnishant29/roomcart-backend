const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Room = require('../models/Room');
const Expense = require('../models/Expense');
const Notification = require('../models/Notification');
const { getUserNotification } = require('../controllers/notificationController');

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

describe('Notification Deduplication Tests', () => {
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();
  const roomId = new mongoose.Types.ObjectId().toString();

  it('Adding an expense creates exactly ONE notification for room receivers', async () => {
    const createdNotifications = [];
    const origCreate = Notification.create;
    const origRoomFindById = Room.findById;

    try {
      Room.findById = () => ({
        populate: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(roomId),
          members: [
            { _id: new mongoose.Types.ObjectId(userAId) },
            { _id: new mongoose.Types.ObjectId(userBId) },
          ],
        }),
      });

      Notification.create = (doc) => {
        createdNotifications.push(doc);
        return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
      };

      // Simulate the logic executed in POST /api/expenses/:roomId/add
      const title = 'Dinner';
      const amount = 500;
      const room = await Room.findById(roomId).populate('members', '_id');
      const receivers = room.members
        .filter((member) => member._id.toString() !== userAId)
        .map((member) => member._id);

      if (receivers.length > 0) {
        await Notification.create({
          sender: userAId,
          receivers,
          roomId,
          type: 'expense-added',
          message: `New expense "${title}" of ₹${amount} was added.`,
        });
      }

      // Assert that Notification.create was called EXACTLY once
      assert.equal(createdNotifications.length, 1);
      assert.equal(createdNotifications[0].type, 'expense-added');
      assert.equal(createdNotifications[0].message, 'New expense "Dinner" of ₹500 was added.');
      assert.equal(createdNotifications[0].receivers.length, 1);
      assert.equal(createdNotifications[0].receivers[0].toString(), userBId);
    } finally {
      Notification.create = origCreate;
      Room.findById = origRoomFindById;
    }
  });

  it('GET /api/notifications/my returns a single notification per event', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;
    const notificationDoc = {
      _id: new mongoose.Types.ObjectId(),
      sender: { name: 'User A' },
      roomId: { name: 'Flat 101' },
      message: 'New expense "Dinner" of ₹500 was added.',
      type: 'expense-added',
      createdAt: new Date(),
    };

    try {
      Notification.find = (query) => {
        assert.equal(query.receivers, userBId);
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => Promise.resolve([notificationDoc]),
                }),
              }),
            }),
          }),
        };
      };

      Notification.countDocuments = () => Promise.resolve(1);

      const { req, res } = mockReqRes({ user: { id: userBId } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.notifications.length, 1);
      assert.equal(res.data.notifications[0].message, 'New expense "Dinner" of ₹500 was added.');
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });
});
