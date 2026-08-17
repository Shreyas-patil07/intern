const express = require('express');
const router = express.Router();

const {
  createRestaurant,
  getMyRestaurant,
  updateRestaurant,
  getAllRestaurants,
  searchRestaurants
} = require('../controllers/restaurantController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', searchRestaurants);
router.post('/', protect, createRestaurant);
router.get('/my', protect, getMyRestaurant);
router.put('/:id', protect, updateRestaurant);
router.get('/', getAllRestaurants);

module.exports = router;
