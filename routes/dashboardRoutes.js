const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const {
  getDashboardSummary,
  getDashboardActivities,
} = require('../controllers/dashboardController');

// GET /api/dashboard/summary - summary metrics and recent activity for authenticated user
router.get('/summary', auth, getDashboardSummary);

// GET /api/dashboard/activities - recent activity across all user's rooms
router.get('/activities', auth, getDashboardActivities);

module.exports = router;
