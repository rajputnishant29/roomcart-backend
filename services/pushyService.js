const User = require('../models/User');

const PUSHY_API_URL = 'https://api.pushy.me/push';
const REQUEST_TIMEOUT_MS = 5000;

let warnedMissingApiKey = false;

/**
 * Sends a push notification to one or multiple device tokens via Pushy API.
 * 
 * @param {Object} params
 * @param {string|string[]} params.tokens - Single token or array of device tokens.
 * @param {string} params.title - Push notification title.
 * @param {string} params.message - Push notification body message.
 * @param {Object} [params.data] - Additional custom payload (e.g. type, roomId, etc.).
 * @returns {Promise<Object>} Delivery result object.
 */
async function sendPushNotification({ tokens, title, message, data = {} }) {
  const apiKey = process.env.PUSHY_API_KEY;

  if (!apiKey) {
    if (!warnedMissingApiKey) {
      console.warn('⚠️ [PushyService] PUSHY_API_KEY is not configured. Push notifications will be skipped.');
      warnedMissingApiKey = true;
    }
    return { success: false, skipped: true, message: 'PUSHY_API_KEY not configured' };
  }

  // Normalize tokens to an array of non-empty strings
  const tokenList = (Array.isArray(tokens) ? tokens : [tokens])
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim());

  const uniqueTokens = [...new Set(tokenList)];

  if (uniqueTokens.length === 0) {
    return { success: true, count: 0, message: 'No recipients with registered device tokens' };
  }

  const payload = {
    to: uniqueTokens.length === 1 ? uniqueTokens[0] : uniqueTokens,
    data: {
      title,
      message,
      ...data,
    },
    notification: {
      title,
      body: message,
      sound: 'default',
      badge: 1,
    },
  };

  try {
    const url = `${PUSHY_API_URL}?api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      console.error('❌ [PushyService] Push delivery failed:', {
        status: response.status,
        error: result.error || response.statusText,
        code: result.code,
      });

      // Handle invalid/unregistered token reporting if specifically identified
      if (
        result.code === 'DEVICE_NOT_FOUND' ||
        (result.error && typeof result.error === 'string' && result.error.toLowerCase().includes('device not found'))
      ) {
        if (uniqueTokens.length === 1) {
          const invalidToken = uniqueTokens[0];
          try {
            await User.updateMany(
              { 'pushyDevices.token': invalidToken },
              { $pull: { pushyDevices: { token: invalidToken } } }
            );
            console.log(`🧹 [PushyService] Cleaned up invalid device token`);
          } catch (cleanupErr) {
            console.error('❌ [PushyService] Error cleaning invalid device token:', cleanupErr.message);
          }
        }
      }

      return {
        success: false,
        status: response.status,
        error: result.error || response.statusText,
      };
    }

    return {
      success: true,
      id: result.id,
      count: uniqueTokens.length,
    };
  } catch (error) {
    console.error('❌ [PushyService] Network/Request error while sending push:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sends a push notification to all registered devices of the given user IDs.
 *
 * @param {Object} params
 * @param {Array<string|mongoose.Types.ObjectId>} params.userIds - Array of recipient User IDs.
 * @param {string} params.title - Push notification title.
 * @param {string} params.message - Push notification body message.
 * @param {Object} [params.data] - Additional custom payload.
 * @returns {Promise<Object>} Delivery result object.
 */
async function sendPushToUsers({ userIds, title, message, data = {} }) {
  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return { success: true, count: 0 };
    }

    const users = await User.find({ _id: { $in: userIds } }).select('+pushyDevices');

    const tokens = [];
    for (const user of users) {
      if (Array.isArray(user.pushyDevices)) {
        for (const device of user.pushyDevices) {
          if (device && device.token) {
            tokens.push(device.token);
          }
        }
      }
    }

    if (tokens.length === 0) {
      return { success: true, count: 0 };
    }

    return await sendPushNotification({ tokens, title, message, data });
  } catch (error) {
    console.error('❌ [PushyService] Failed to send push to users:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendPushToUsers,
};
