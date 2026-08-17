const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const {
  calculateDelivery,
  placeOrder,
  mockPayment,
  cancelOrder,
  requestRefund,
  getMyOrders,
  getRestaurantOrders
} = require('../controllers/orderController');

router.use(protect);

router.post('/calculate-delivery-fee', authorize('user'), calculateDelivery);
router.post('/', authorize('user'), placeOrder);
router.post('/create', authorize('user'), placeOrder);
router.post('/verify', authorize('user'), mockPayment);
router.post('/:orderId/pay', authorize('user'), mockPayment);
router.post('/cancel/:orderId', authorize('user'), cancelOrder);
router.post('/refund/:orderId', authorize('user'), requestRefund);
router.get('/my', authorize('user'), getMyOrders);
router.get('/restaurant', authorize('restaurant'), getRestaurantOrders);

module.exports = router;
