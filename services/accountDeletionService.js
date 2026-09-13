const mongoose = require('mongoose');
const User = require('../models/User');
const Room = require('../models/Room');
const Expense = require('../models/Expense');
const SettlementRequest = require('../models/SettlementRequest');
const Notification = require('../models/Notification');
const ChatMessage = require('../models/ChatMessage');

/**
 * Permanently deletes a user account and cleans up all associated user data
 * while safely preserving shared group history for remaining room members.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the authenticated user to delete
 * @returns {Promise<{ success?: boolean, notFound?: boolean, message: string }>}
 */
async function deleteUserAccount(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('INVALID_USER_ID');
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const userStringId = userObjectId.toString();

  // 1. Verify user exists
  const existingUser = await User.findById(userObjectId);
  if (!existingUser) {
    return { notFound: true, message: 'User not found' };
  }

  // 2. Determine session / transaction support
  let session = null;
  let useTransaction = false;

  if (mongoose.connection?.readyState === 1 && typeof mongoose.startSession === 'function') {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessionErr) {
      // Standalone MongoDB instances without replica sets do not support transactions.
      // Fall back safely to idempotent sequential execution.
      if (session) {
        try {
          await session.endSession();
        } catch (_) {}
        session = null;
      }
      useTransaction = false;
    }
  }

  try {
    const sessionOption = useTransaction && session ? { session } : {};

    // 3. Find all rooms where the user is admin or a member
    const userRooms = await Room.find(
      {
        $or: [{ admin: userObjectId }, { members: userObjectId }],
      },
      null,
      sessionOption
    );

    const soleMemberRoomIds = [];

    // 4. Process each room: classify sole-member vs shared
    for (const room of userRooms) {
      const remainingMembers = (room.members || []).filter(
        (m) => m && m.toString() !== userStringId
      );

      if (remainingMembers.length === 0) {
        // User is the only remaining member -> delete the room & its room-scoped data
        soleMemberRoomIds.push(room._id);
      } else {
        // Shared room with remaining members
        const isAdmin = room.admin && room.admin.toString() === userStringId;
        const updateDoc = {
          $pull: { members: userObjectId },
        };

        if (isAdmin) {
          // Transfer admin responsibility to the first remaining member
          updateDoc.$set = { admin: remainingMembers[0] };
        }

        await Room.updateOne({ _id: room._id }, updateDoc, sessionOption);
      }
    }

    // 5. Delete sole-member rooms and all associated room-scoped data
    if (soleMemberRoomIds.length > 0) {
      await Expense.deleteMany({ room: { $in: soleMemberRoomIds } }, sessionOption);
      await SettlementRequest.deleteMany({ room: { $in: soleMemberRoomIds } }, sessionOption);
      await Notification.deleteMany({ roomId: { $in: soleMemberRoomIds } }, sessionOption);
      await ChatMessage.deleteMany({ roomId: { $in: soleMemberRoomIds } }, sessionOption);
      await Room.deleteMany({ _id: { $in: soleMemberRoomIds } }, sessionOption);
    }

    // 6. Clean up pending settlement requests involving the deleting user
    // (Pending requests cannot proceed once a party's account is deleted)
    await SettlementRequest.deleteMany(
      {
        $or: [{ from: userObjectId }, { to: userObjectId }],
        status: 'pending',
      },
      sessionOption
    );

    // 7. Clean up notifications:
    // a. Pull user from all receivers arrays
    await Notification.updateMany(
      { receivers: userObjectId },
      { $pull: { receivers: userObjectId } },
      sessionOption
    );

    // b. Delete any notification that now has 0 receivers
    await Notification.deleteMany({ receivers: { $size: 0 } }, sessionOption);

    // 8. Permanently delete the User document (clears profile, password, pushyDevices, reset tokens)
    await User.deleteOne({ _id: userObjectId }, sessionOption);

    // 9. Commit transaction if active
    if (useTransaction && session) {
      await session.commitTransaction();
    }

    return { success: true, message: 'Account deleted successfully.' };
  } catch (error) {
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error('Error aborting transaction:', abortErr.message);
      }
    }
    throw error;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (_) {}
    }
  }
}

module.exports = {
  deleteUserAccount,
};
