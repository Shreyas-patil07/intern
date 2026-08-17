const User = require('../models/User');
const { getRecommendations } = require('../services/recommendationService');

exports.getUserRecommendations = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && req.user._id.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view these recommendations'
      });
    }

    const user = await User.findById(targetUserId).select('_id name preferenceProfile');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const recommendations = await getRecommendations(targetUserId, {
      limit: req.query.limit
    });

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name
      },
      preferences: user.preferenceProfile || {
        cuisines: [],
        items: [],
        ordersCount: 0
      },
      data: recommendations,
      count: recommendations.length
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
