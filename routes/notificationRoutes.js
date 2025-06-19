const express = require('express');
const router = express.Router();
const { getUserNotification} = require('../controllers/notificationController');
const auth = require('../middlewares/auth');

router.get('/my', auth, getUserNotification);

module.exports = router;
