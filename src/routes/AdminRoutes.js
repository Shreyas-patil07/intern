const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getAllUsers,
  toggleBlockUser,
  approveRestaurant,
  createRestaurant,
  updateRestaurant,
  getAllOrders,
  getPlatformStatistics,
  getFraudOrders,
  approveFraudOrder,
  rejectFraudOrder,
  restrictFraudUser
} = require('../controllers/AdminController');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getAllUsers);
router.put('/users/:id/block', toggleBlockUser);
router.put('/restaurant/:id/approve', approveRestaurant);
router.post('/restaurants/create', createRestaurant);
router.put('/restaurants/update/:restaurantId', updateRestaurant);
router.get('/statistics', getPlatformStatistics);
router.get('/orders', getAllOrders);

router.get('/fraud/orders', getFraudOrders);
router.put('/fraud/orders/:orderId/approve', approveFraudOrder);
router.put('/fraud/orders/:orderId/reject', rejectFraudOrder);
router.put('/fraud/orders/:orderId/restrict-user', restrictFraudUser);

module.exports = router;
