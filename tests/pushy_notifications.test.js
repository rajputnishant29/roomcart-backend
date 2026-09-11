const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const Notification = require('../models/Notification');
const Room = require('../models/Room');
const Expense = require('../models/Expense');
const SettlementRequest = require('../models/SettlementRequest');

const {
  registerDevice,
  unregisterDevice,
} = require('../controllers/notificationController');
const {
  sendPushNotification,
  sendPushToUsers,
} = require('../services/pushyService');
const {
  markAsPaidRequest,
  approveSettlement,
} = require('../controllers/settlementController');
const { joinRoom } = require('../controllers/roomController');

function mockReqRes(options = {}) {
  const req = {
    user: options.user || { id: new mongoose.Types.ObjectId().toString() },
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    app: {
      get: (key) => {
        if (key === 'io') {
          return {
            to: () => ({ emit: () => {} }),
            sockets: { sockets: new Map() },
          };
        }
        return null;
      },
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

describe('Pushy Push Notifications Backend Tests', () => {
  const origPushyKey = process.env.PUSHY_API_KEY;
  let origFetch;

  beforeEach(() => {
    process.env.PUSHY_API_KEY = 'test_secret_pushy_api_key_12345';
    origFetch = global.fetch;
  });

  afterEach(() => {
    process.env.PUSHY_API_KEY = origPushyKey;
    global.fetch = origFetch;
  });

  describe('1. Device Registration & Unregistration Endpoints', () => {
    it('POST /api/notifications/device rejects missing token with 400', async () => {
      const { req, res } = mockReqRes({ body: {} });
      await registerDevice(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.data.message, /token is required/i);
    });

    it('POST /api/notifications/device rejects whitespace or empty token with 400', async () => {
      const { req, res } = mockReqRes({ body: { token: '   ' } });
      await registerDevice(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.data.message, /token is required/i);
    });

    it('POST /api/notifications/device registers a valid token for authenticated user', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockUser = {
        _id: userId,
        name: 'Test User',
        pushyDevices: [],
        save: async function () {
          return this;
        },
      };

      const origFindById = User.findById;
      try {
        User.findById = (id) => {
          assert.equal(id.toString(), userId);
          return {
            select: (sel) => {
              assert.equal(sel, '+pushyDevices');
              return Promise.resolve(mockUser);
            },
          };
        };

        const { req, res } = mockReqRes({
          user: { id: userId },
          body: { token: 'device_token_abc_1', platform: 'android' },
        });

        await registerDevice(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.message, 'Push notification device registered successfully');
        assert.equal(mockUser.pushyDevices.length, 1);
        assert.equal(mockUser.pushyDevices[0].token, 'device_token_abc_1');
        assert.equal(mockUser.pushyDevices[0].platform, 'android');
      } finally {
        User.findById = origFindById;
      }
    });

    it('POST /api/notifications/device registering the same token twice updates updatedAt and prevents duplicates', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const oldDate = new Date(Date.now() - 100000);
      const mockUser = {
        _id: userId,
        pushyDevices: [
          {
            token: 'device_token_abc_1',
            platform: 'android',
            updatedAt: oldDate,
          },
        ],
        save: async function () {
          return this;
        },
      };

      const origFindById = User.findById;
      try {
        User.findById = () => ({
          select: () => Promise.resolve(mockUser),
        });

        const { req, res } = mockReqRes({
          user: { id: userId },
          body: { token: 'device_token_abc_1', platform: 'ios' },
        });

        await registerDevice(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(mockUser.pushyDevices.length, 1, 'Device array length must still be 1 (no duplicate)');
        assert.equal(mockUser.pushyDevices[0].token, 'device_token_abc_1');
        assert.equal(mockUser.pushyDevices[0].platform, 'ios');
        assert.ok(mockUser.pushyDevices[0].updatedAt > oldDate);
      } finally {
        User.findById = origFindById;
      }
    });

    it('POST /api/notifications/device allows multiple distinct devices for the same user', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const mockUser = {
        _id: userId,
        pushyDevices: [
          {
            token: 'device_token_phone',
            platform: 'android',
            updatedAt: new Date(),
          },
        ],
        save: async function () {
          return this;
        },
      };

      const origFindById = User.findById;
      try {
        User.findById = () => ({
          select: () => Promise.resolve(mockUser),
        });

        const { req, res } = mockReqRes({
          user: { id: userId },
          body: { token: 'device_token_tablet', platform: 'android' },
        });

        await registerDevice(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(mockUser.pushyDevices.length, 2);
        assert.equal(mockUser.pushyDevices[0].token, 'device_token_phone');
        assert.equal(mockUser.pushyDevices[1].token, 'device_token_tablet');
      } finally {
        User.findById = origFindById;
      }
    });

    it('DELETE /api/notifications/device unregisters device token for authenticated user', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      let updateQueryCalled = null;

      const origUpdateOne = User.updateOne;
      try {
        User.updateOne = (filter, update) => {
          updateQueryCalled = { filter, update };
          return Promise.resolve({ modifiedCount: 1 });
        };

        const { req, res } = mockReqRes({
          user: { id: userId },
          body: { token: 'device_token_abc_1' },
        });

        await unregisterDevice(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.message, 'Device unregistered successfully');
        assert.deepEqual(updateQueryCalled.filter, { _id: userId });
        assert.deepEqual(updateQueryCalled.update, {
          $pull: { pushyDevices: { token: 'device_token_abc_1' } },
        });
      } finally {
        User.updateOne = origUpdateOne;
      }
    });

    it('DELETE /api/notifications/device rejects missing token with 400', async () => {
      const { req, res } = mockReqRes({ body: {} });
      await unregisterDevice(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.data.message, /token is required/i);
    });
  });

  describe('2. Pushy Service & Payload Verification', () => {
    it('sendPushNotification skips gracefully when PUSHY_API_KEY is not configured', async () => {
      delete process.env.PUSHY_API_KEY;

      const result = await sendPushNotification({
        tokens: ['dummy_token'],
        title: 'Test',
        message: 'Hello',
      });

      assert.equal(result.success, false);
      assert.equal(result.skipped, true);
      assert.equal(result.message, 'PUSHY_API_KEY not configured');
    });

    it('sendPushNotification sends correct HTTP POST request to Pushy API endpoint with valid headers and payload', async () => {
      let fetchUrl = null;
      let fetchOptions = null;

      global.fetch = async (url, options) => {
        fetchUrl = url;
        fetchOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, id: 'pushy_msg_id_999' }),
        };
      };

      const result = await sendPushNotification({
        tokens: ['device_token_1', 'device_token_2'],
        title: 'New expense',
        message: 'New expense "Groceries" of ₹800 was added.',
        data: {
          type: 'expense-added',
          roomId: 'room_123',
          expenseId: 'exp_456',
        },
      });

      assert.equal(result.success, true);
      assert.equal(result.id, 'pushy_msg_id_999');
      assert.equal(result.count, 2);

      // Verify Endpoint & API Key passed as query parameter
      assert.ok(fetchUrl.startsWith('https://api.pushy.me/push?api_key='));
      assert.ok(fetchUrl.includes(process.env.PUSHY_API_KEY));

      // Verify Headers
      assert.equal(fetchOptions.method, 'POST');
      assert.equal(fetchOptions.headers['Content-Type'], 'application/json');

      // Verify Body Payload
      const body = JSON.parse(fetchOptions.body);
      assert.deepEqual(body.to, ['device_token_1', 'device_token_2']);
      assert.equal(body.data.title, 'New expense');
      assert.equal(body.data.message, 'New expense "Groceries" of ₹800 was added.');
      assert.equal(body.data.type, 'expense-added');
      assert.equal(body.data.roomId, 'room_123');
      assert.equal(body.data.expenseId, 'exp_456');

      assert.equal(body.notification.title, 'New expense');
      assert.equal(body.notification.body, 'New expense "Groceries" of ₹800 was added.');
      assert.equal(body.notification.badge, 1);
    });

    it('sendPushToUsers aggregates registered device tokens of target users and sends push', async () => {
      const user1Id = new mongoose.Types.ObjectId().toString();
      const user2Id = new mongoose.Types.ObjectId().toString();

      const origUserFind = User.find;
      let pushyPayloadSent = null;

      try {
        User.find = (filter) => {
          assert.deepEqual(filter._id.$in, [user1Id, user2Id]);
          return {
            select: () => Promise.resolve([
              {
                _id: user1Id,
                pushyDevices: [{ token: 'token_user_1_phone' }],
              },
              {
                _id: user2Id,
                pushyDevices: [
                  { token: 'token_user_2_phone' },
                  { token: 'token_user_2_tablet' },
                ],
              },
            ]),
          };
        };

        global.fetch = async (url, options) => {
          pushyPayloadSent = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, id: 'batch_msg_1' }),
          };
        };

        const result = await sendPushToUsers({
          userIds: [user1Id, user2Id],
          title: 'Room update',
          message: 'Alice joined the room',
          data: {
            type: 'joined',
            roomId: 'room_abc',
          },
        });

        assert.equal(result.success, true);
        assert.equal(result.count, 3);
        assert.deepEqual(pushyPayloadSent.to, [
          'token_user_1_phone',
          'token_user_2_phone',
          'token_user_2_tablet',
        ]);
        assert.equal(pushyPayloadSent.data.type, 'joined');
        assert.equal(pushyPayloadSent.data.roomId, 'room_abc');
      } finally {
        User.find = origUserFind;
      }
    });

    it('sendPushNotification handles Pushy API HTTP 500 error gracefully without throwing', async () => {
      global.fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ success: false, error: 'Pushy service unavailable' }),
      });

      const result = await sendPushNotification({
        tokens: ['device_token_x'],
        title: 'Test Error',
        message: 'Error handling test',
      });

      assert.equal(result.success, false);
      assert.equal(result.status, 500);
      assert.equal(result.error, 'Pushy service unavailable');
    });

    it('sendPushNotification cleans up invalid/unregistered token when reported by Pushy', async () => {
      let cleanedToken = null;
      const origUpdateMany = User.updateMany;

      try {
        User.updateMany = (filter, update) => {
          cleanedToken = filter['pushyDevices.token'];
          return Promise.resolve({ modifiedCount: 1 });
        };

        global.fetch = async () => ({
          ok: false,
          status: 400,
          json: async () => ({ success: false, code: 'DEVICE_NOT_FOUND', error: 'Device not found' }),
        });

        const result = await sendPushNotification({
          tokens: ['invalid_device_token_xyz'],
          title: 'Test Invalid',
          message: 'Invalid test',
        });

        assert.equal(result.success, false);
        assert.equal(cleanedToken, 'invalid_device_token_xyz');
      } finally {
        User.updateMany = origUpdateMany;
      }
    });
  });

  describe('3. Event Flows Integration & Deduplication', () => {
    it('Expense creation creates 1 MongoDB notification and triggers Pushy without sender in receivers', async () => {
      const userAId = new mongoose.Types.ObjectId().toString(); // sender
      const userBId = new mongoose.Types.ObjectId().toString(); // receiver 1
      const userCId = new mongoose.Types.ObjectId().toString(); // receiver 2
      const roomId = new mongoose.Types.ObjectId().toString();

      const createdNotifications = [];
      let pushyPayload = null;

      const origRoomFindById = Room.findById;
      const origNotificationCreate = Notification.create;
      const origUserFind = User.find;

      try {
        Room.findById = () => ({
          populate: () => Promise.resolve({
            _id: new mongoose.Types.ObjectId(roomId),
            members: [
              { _id: new mongoose.Types.ObjectId(userAId) },
              { _id: new mongoose.Types.ObjectId(userBId) },
              { _id: new mongoose.Types.ObjectId(userCId) },
            ],
          }),
        });

        Notification.create = (doc) => {
          createdNotifications.push(doc);
          return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
        };

        User.find = (filter) => ({
          select: () => Promise.resolve([
            { _id: userBId, pushyDevices: [{ token: 'token_user_B' }] },
            { _id: userCId, pushyDevices: [{ token: 'token_user_C' }] },
          ]),
        });

        global.fetch = async (url, options) => {
          pushyPayload = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, id: 'expense_push_1' }),
          };
        };

        // Replicate route action logic
        const title = 'Wifi Bill';
        const amount = 1200;
        const room = await Room.findById(roomId).populate('members', '_id');
        const receivers = room.members
          .filter((m) => m._id.toString() !== userAId)
          .map((m) => m._id);

        assert.equal(receivers.length, 2);
        assert.ok(!receivers.some((r) => r.toString() === userAId), 'Sender must not be in receivers');

        const notification = await Notification.create({
          sender: userAId,
          receivers,
          roomId,
          type: 'expense-added',
          message: `New expense "${title}" of ₹${amount} was added.`,
        });

        await sendPushToUsers({
          userIds: receivers,
          title: 'New expense',
          message: notification.message,
          data: {
            type: 'expense-added',
            notificationId: notification._id.toString(),
            roomId: roomId.toString(),
            expenseId: 'mock_expense_id',
          },
        });

        // Exactly one notification created
        assert.equal(createdNotifications.length, 1);
        assert.equal(createdNotifications[0].type, 'expense-added');

        // Push delivered to user B and C tokens only
        assert.deepEqual(pushyPayload.to, ['token_user_B', 'token_user_C']);
        assert.equal(pushyPayload.data.title, 'New expense');
        assert.equal(pushyPayload.data.type, 'expense-added');
        assert.equal(pushyPayload.data.roomId, roomId);
      } finally {
        Room.findById = origRoomFindById;
        Notification.create = origNotificationCreate;
        User.find = origUserFind;
      }
    });

    it('Settlement request creates 1 MongoDB notification and triggers Pushy for target user', async () => {
      const fromUserId = new mongoose.Types.ObjectId().toString();
      const toUserId = new mongoose.Types.ObjectId().toString();
      const roomId = new mongoose.Types.ObjectId().toString();

      const createdNotifications = [];
      let pushyPayload = null;

      const origSettlementFindOne = SettlementRequest.findOne;
      const origSettlementSave = SettlementRequest.prototype.save;
      const origNotificationCreate = Notification.create;
      const origUserFind = User.find;

      try {
        SettlementRequest.findOne = () => Promise.resolve(null);
        SettlementRequest.prototype.save = function () {
          this._id = new mongoose.Types.ObjectId();
          return Promise.resolve(this);
        };

        Notification.create = (doc) => {
          createdNotifications.push(doc);
          return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
        };

        User.find = (filter) => ({
          select: () => Promise.resolve([
            { _id: toUserId, pushyDevices: [{ token: 'token_to_user' }] },
          ]),
        });

        global.fetch = async (url, options) => {
          pushyPayload = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, id: 'settle_req_push' }),
          };
        };

        const { req, res } = mockReqRes({
          body: {
            from: fromUserId,
            to: toUserId,
            amount: 450,
            roomId,
          },
        });

        await markAsPaidRequest(req, res);

        assert.equal(res.statusCode, 201);
        assert.equal(createdNotifications.length, 1);
        assert.equal(createdNotifications[0].type, 'settlement-request');
        assert.equal(createdNotifications[0].receivers[0].toString(), toUserId);

        // Allow microtask to complete push
        await new Promise((r) => setTimeout(r, 10));

        assert.ok(pushyPayload !== null);
        assert.equal(pushyPayload.to, 'token_to_user');
        assert.equal(pushyPayload.data.type, 'settlement-request');
        assert.equal(pushyPayload.data.title, 'Settlement request');
      } finally {
        SettlementRequest.findOne = origSettlementFindOne;
        SettlementRequest.prototype.save = origSettlementSave;
        Notification.create = origNotificationCreate;
        User.find = origUserFind;
      }
    });

    it('Settlement approval creates 1 MongoDB notification and triggers Pushy for requester', async () => {
      const fromUserId = new mongoose.Types.ObjectId().toString(); // original requester
      const toUserId = new mongoose.Types.ObjectId().toString();   // approver (current user)
      const roomId = new mongoose.Types.ObjectId().toString();
      const requestId = new mongoose.Types.ObjectId().toString();

      const createdNotifications = [];
      let pushyPayload = null;

      const mockRequest = {
        _id: requestId,
        from: new mongoose.Types.ObjectId(fromUserId),
        to: new mongoose.Types.ObjectId(toUserId),
        room: new mongoose.Types.ObjectId(roomId),
        amount: 300,
        status: 'pending',
        save: async function () {
          return this;
        },
      };

      const origSettlementFindById = SettlementRequest.findById;
      const origNotificationCreate = Notification.create;
      const origUserFind = User.find;

      try {
        SettlementRequest.findById = () => Promise.resolve(mockRequest);

        Notification.create = (doc) => {
          createdNotifications.push(doc);
          return Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
        };

        User.find = (filter) => ({
          select: () => Promise.resolve([
            { _id: fromUserId, pushyDevices: [{ token: 'token_requester' }] },
          ]),
        });

        global.fetch = async (url, options) => {
          pushyPayload = JSON.parse(options.body);
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, id: 'settle_appr_push' }),
          };
        };

        const { req, res } = mockReqRes({
          user: { id: toUserId },
          params: { requestId },
        });

        await approveSettlement(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(createdNotifications.length, 1);
        assert.equal(createdNotifications[0].type, 'settlement-approved');
        assert.equal(createdNotifications[0].receivers[0].toString(), fromUserId);

        await new Promise((r) => setTimeout(r, 10));

        assert.ok(pushyPayload !== null);
        assert.equal(pushyPayload.to, 'token_requester');
        assert.equal(pushyPayload.data.type, 'settlement-approved');
        assert.equal(pushyPayload.data.title, 'Settlement approved');
      } finally {
        SettlementRequest.findById = origSettlementFindById;
        Notification.create = origNotificationCreate;
        User.find = origUserFind;
      }
    });

    it('Pushy failure does NOT cause settlement approval or business operations to fail', async () => {
      const fromUserId = new mongoose.Types.ObjectId().toString();
      const toUserId = new mongoose.Types.ObjectId().toString();
      const requestId = new mongoose.Types.ObjectId().toString();

      const mockRequest = {
        _id: requestId,
        from: new mongoose.Types.ObjectId(fromUserId),
        to: new mongoose.Types.ObjectId(toUserId),
        room: new mongoose.Types.ObjectId(),
        amount: 500,
        status: 'pending',
        save: async function () {
          return this;
        },
      };

      const origSettlementFindById = SettlementRequest.findById;
      const origNotificationCreate = Notification.create;
      const origUserFind = User.find;

      try {
        SettlementRequest.findById = () => Promise.resolve(mockRequest);
        Notification.create = (doc) => Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });
        User.find = () => ({
          select: () => Promise.resolve([{ _id: fromUserId, pushyDevices: [{ token: 'some_tok' }] }]),
        });

        // Simulate Pushy network timeout / crash
        global.fetch = async () => {
          throw new Error('Connection refused / network timeout');
        };

        const { req, res } = mockReqRes({
          user: { id: toUserId },
          params: { requestId },
        });

        await approveSettlement(req, res);

        // Business operation MUST still succeed
        assert.equal(res.statusCode, 200);
        assert.equal(res.data.message, 'Settlement approved');
        assert.equal(mockRequest.status, 'approved');
      } finally {
        SettlementRequest.findById = origSettlementFindById;
        Notification.create = origNotificationCreate;
        User.find = origUserFind;
      }
    });

    it('Pushy service passes AbortSignal timeout to fetch', async () => {
      let passedSignal = null;
      global.fetch = async (url, options) => {
        passedSignal = options.signal;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, id: 'timeout_test_id' }),
        };
      };

      const result = await sendPushNotification({
        tokens: ['test_token'],
        title: 'Timeout Test',
        message: 'Checking signal',
      });

      assert.equal(result.success, true);
      assert.ok(passedSignal instanceof AbortSignal, 'fetch must receive an AbortSignal');
    });

    it('Pushy failure does NOT cause room join to fail', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const adminId = new mongoose.Types.ObjectId().toString();
      const roomId = new mongoose.Types.ObjectId().toString();

      const mockRoom = {
        _id: roomId,
        roomCode: 'RM1234',
        members: [{ _id: adminId, toString: () => adminId }],
        save: async function () { return this; },
      };

      const origRoomFindOne = Room.findOne;
      const origUserFindById = User.findById;
      const origUserFind = User.find;
      const origNotificationCreate = Notification.create;

      try {
        Room.findOne = () => ({
          populate: () => Promise.resolve(mockRoom),
        });
        User.findById = () => Promise.resolve({ _id: userId, name: 'Joining User' });
        User.find = () => ({
          select: () => Promise.resolve([{ _id: adminId, pushyDevices: [{ token: 'admin_tok' }] }]),
        });
        Notification.create = (doc) => Promise.resolve({ _id: new mongoose.Types.ObjectId(), ...doc });

        // Simulate Pushy network crash
        global.fetch = async () => {
          throw new Error('Pushy server 503 error');
        };

        const { req, res } = mockReqRes({
          user: { id: userId },
          body: { roomCode: 'RM1234' },
        });

        await joinRoom(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.message, 'Joined room successfully');
      } finally {
        Room.findOne = origRoomFindOne;
        User.findById = origUserFindById;
        User.find = origUserFind;
        Notification.create = origNotificationCreate;
      }
    });
  });
});

