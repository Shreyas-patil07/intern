const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');
const { addToCart } = require('../controllers/cartController');

router.use(protect);
router.use(authorize('user'));
router.post('/', addToCart);

module.exports = router;
