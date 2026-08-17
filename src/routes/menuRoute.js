const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const {
  addMenuItem,
  getMyMenu,
  deleteMenuItem,
  updateMenuItem
} = require('../controllers/menuController');

router.post('/', protect, addMenuItem);
router.get('/my', protect, getMyMenu);
router.delete('/:id', protect, deleteMenuItem);
router.put('/:id', protect, updateMenuItem);

module.exports = router;
