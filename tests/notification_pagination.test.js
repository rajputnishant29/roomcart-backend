const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

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

describe('Notification Pagination Tests', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

  // Create 35 dummy notification records
  const generateNotifications = (count, recipientId) => {
    return Array.from({ length: count }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(),
      sender: { _id: new mongoose.Types.ObjectId(), name: `Sender ${i}` },
      roomId: { _id: new mongoose.Types.ObjectId(), name: `Room ${i}` },
      receivers: [new mongoose.Types.ObjectId(recipientId)],
      message: `Notification message ${i + 1}`,
      type: 'expense-added',
      createdAt: new Date(Date.now() - i * 1000),
    }));
  };

  const allUserNotifications = generateNotifications(35, userId);

  it('1. Default request returns at most 15 notifications and page 1 pagination metadata', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = (filter) => {
        assert.equal(filter.receivers.toString(), userId);
        return {
          sort: () => ({
            skip: (skipVal) => {
              assert.equal(skipVal, 0);
              return {
                limit: (limVal) => {
                  assert.equal(limVal, 15);
                  return {
                    populate: () => ({
                      populate: () => Promise.resolve(allUserNotifications.slice(0, 15)),
                    }),
                  };
                },
              };
            },
          }),
        };
      };

      Notification.countDocuments = (filter) => {
        assert.equal(filter.receivers.toString(), userId);
        return Promise.resolve(35);
      };

      const { req, res } = mockReqRes({ user: { id: userId }, query: {} });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.notifications.length, 15);
      assert.deepEqual(res.data.pagination, {
        page: 1,
        limit: 15,
        total: 35,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('2. ?limit=10 returns at most 10 items and sets limit: 10 in metadata', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: (limVal) => {
              assert.equal(limVal, 10);
              return {
                populate: () => ({
                  populate: () => Promise.resolve(allUserNotifications.slice(0, 10)),
                }),
              };
            },
          }),
        }),
      });

      Notification.countDocuments = () => Promise.resolve(35);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { limit: '10' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.notifications.length, 10);
      assert.equal(res.data.pagination.limit, 10);
      assert.equal(res.data.pagination.totalPages, 4);
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('3. ?limit=100 is capped at maximum allowed limit of 50', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: (limVal) => {
              assert.equal(limVal, 50);
              return {
                populate: () => ({
                  populate: () => Promise.resolve([]),
                }),
              };
            },
          }),
        }),
      });

      Notification.countDocuments = () => Promise.resolve(35);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { limit: '100' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.pagination.limit, 50);
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('4. ?page=2&limit=10 skips 10 and returns the correct second page', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: (skipVal) => {
            assert.equal(skipVal, 10);
            return {
              limit: (limVal) => {
                assert.equal(limVal, 10);
                return {
                  populate: () => ({
                    populate: () => Promise.resolve(allUserNotifications.slice(10, 20)),
                  }),
                };
              },
            };
          },
        }),
      });

      Notification.countDocuments = () => Promise.resolve(35);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { page: '2', limit: '10' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.notifications.length, 10);
      assert.deepEqual(res.data.pagination, {
        page: 2,
        limit: 10,
        total: 35,
        totalPages: 4,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('5. Last page correctly indicates hasNextPage: false and hasPreviousPage: true', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: (skipVal) => {
            assert.equal(skipVal, 30);
            return {
              limit: (limVal) => {
                assert.equal(limVal, 10);
                return {
                  populate: () => ({
                    populate: () => Promise.resolve(allUserNotifications.slice(30, 35)),
                  }),
                };
              },
            };
          },
        }),
      });

      Notification.countDocuments = () => Promise.resolve(35);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { page: '4', limit: '10' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.notifications.length, 5);
      assert.equal(res.data.pagination.page, 4);
      assert.equal(res.data.pagination.hasNextPage, false);
      assert.equal(res.data.pagination.hasPreviousPage, true);
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('6. Invalid/negative query parameters fall back safely to defaults', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: (skipVal) => {
            assert.equal(skipVal, 0); // page 1 -> skip 0
            return {
              limit: (limVal) => {
                assert.equal(limVal, 15); // limit fallback 15
                return {
                  populate: () => ({
                    populate: () => Promise.resolve([]),
                  }),
                };
              },
            };
          },
        }),
      });

      Notification.countDocuments = () => Promise.resolve(0);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { page: 'abc', limit: '-5' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.data.pagination.page, 1);
      assert.equal(res.data.pagination.limit, 15);
      assert.equal(res.data.pagination.totalPages, 0);
      assert.equal(res.data.pagination.hasNextPage, false);
      assert.equal(res.data.pagination.hasPreviousPage, false);
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('7. Security: Users only query their own notifications', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = (filter) => {
        assert.equal(filter.receivers.toString(), otherUserId);
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => Promise.resolve([]),
                }),
              }),
            }),
          }),
        };
      };

      Notification.countDocuments = (filter) => {
        assert.equal(filter.receivers.toString(), otherUserId);
        return Promise.resolve(0);
      };

      const { req, res } = mockReqRes({ user: { id: otherUserId } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });

  it('8. Page beyond total pages returns empty notifications array without crashing', async () => {
    const origFind = Notification.find;
    const origCount = Notification.countDocuments;

    try {
      Notification.find = () => ({
        sort: () => ({
          skip: (skipVal) => {
            assert.equal(skipVal, 100);
            return {
              limit: (limVal) => {
                assert.equal(limVal, 10);
                return {
                  populate: () => ({
                    populate: () => Promise.resolve([]),
                  }),
                };
              },
            };
          },
        }),
      });

      Notification.countDocuments = () => Promise.resolve(35);

      const { req, res } = mockReqRes({ user: { id: userId }, query: { page: '11', limit: '10' } });
      await getUserNotification(req, res);

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.data.notifications, []);
      assert.deepEqual(res.data.pagination, {
        page: 11,
        limit: 10,
        total: 35,
        totalPages: 4,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    } finally {
      Notification.find = origFind;
      Notification.countDocuments = origCount;
    }
  });
});
