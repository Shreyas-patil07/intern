const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const {
  setStatus,
  getMyAssignments,
  declineOrder
} = require('../controllers/deliveryController');

router.use(protect, authorize('delivery'));

router.put('/set-status', setStatus);
router.get('/orders', getMyAssignments);
router.post('/orders/:orderId/decline', declineOrder);

module.exports = router;
