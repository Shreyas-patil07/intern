const express = require('express');
const router = express.Router();

const {
  createRestaurant,
  getMyRestaurant,
  updateRestaurant,
  getAllRestaurants,
  searchRestaurants
} = require('../controllers/restaurantController');
const { getUserRecommendations } = require('../controllers/recommendationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/search', searchRestaurants);
router.get('/recommendations/:userId', protect, getUserRecommendations);
router.post('/', protect, createRestaurant);
router.get('/my', protect, getMyRestaurant);
router.put('/:id', protect, updateRestaurant);
router.get('/', getAllRestaurants);

module.exports = router;
