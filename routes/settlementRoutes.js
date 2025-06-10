const express = require('express');
const router = express.Router();
const { markAsPaidRequest, approveSettlement } = require('../controllers/settlementController');
const auth = require('../middlewares/auth');
const {getMySettlementRequests } = require('../controllers/settlementController');

router.post('/request', auth, markAsPaidRequest);
router.post('/approve/:requestId', auth, approveSettlement);

router.get('/my-requests', auth, getMySettlementRequests);


module.exports = router;
