const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { getMyNotifications, markAsRead } = require('../controllers/notificationController');

router.use(protect);

router.get('/', getMyNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
