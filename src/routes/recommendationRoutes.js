const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getUserRecommendations } = require('../controllers/recommendationController');

const router = express.Router();

router.get('/:userId', protect, getUserRecommendations);

module.exports = router;
