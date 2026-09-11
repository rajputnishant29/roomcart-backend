const express = require('express');
const router = express.Router();
const {
  getUserNotification,
  registerDevice,
  unregisterDevice,
} = require('../controllers/notificationController');
const auth = require('../middlewares/auth');

router.get('/my', auth, getUserNotification);
router.post('/device', auth, registerDevice);
router.delete('/device', auth, unregisterDevice);

module.exports = router;

