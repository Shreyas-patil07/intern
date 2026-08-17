const User = require('../models/User');
const Order = require('../models/Order');
const Restaurant = require('../models/restaurant');

const updateUserPreferences = async (userId, orderId) => {
  const order = await Order.findById(orderId).populate('restaurant', 'cuisine');
  if (!order) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const cuisineCounts = new Map((user.preferenceProfile?.cuisines || []).map((item) => [item.name, item.count]));
  const itemCounts = new Map((user.preferenceProfile?.items || []).map((item) => [item.name, item.count]));

  for (const cuisine of order.restaurant?.cuisine || []) {
    const key = cuisine.trim();
    if (key) cuisineCounts.set(key, (cuisineCounts.get(key) || 0) + 1);
  }

  for (const item of order.items || []) {
    const key = item.name.trim();
    if (key) itemCounts.set(key, (itemCounts.get(key) || 0) + item.quantity);
  }

  user.preferenceProfile = {
    cuisines: [...cuisineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => ({ name, count })),
    items: [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, count]) => ({ name, count })),
    ordersCount: (user.preferenceProfile?.ordersCount || 0) + 1
  };

  await user.save();
  return user.preferenceProfile;
};

const getRecommendations = async (userId, { limit = 10 } = {}) => {
  const user = await User.findById(userId).select('preferenceProfile');
  if (!user) throw new Error('User not found');

  const cuisinePreferences = (user.preferenceProfile?.cuisines || []).map((item) => item.name);
  const itemPreferences = (user.preferenceProfile?.items || []).map((item) => item.name);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  if (cuisinePreferences.length === 0 && itemPreferences.length === 0) {
    return Restaurant.find({ isApproved: true })
      .sort({ rating: -1, popularity: -1 })
      .limit(safeLimit)
      .select('name city address cuisine rating priceRange estimatedDeliveryTime isVegOnly popularity image')
      .lean();
  }

  const pipeline = [
    { $match: { isApproved: true } },
    {
      $lookup: {
        from: 'menus',
        let: { restaurantId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$restaurant', '$$restaurantId'] } } },
          { $project: { name: 1 } }
        ],
        as: 'menuItems'
      }
    },
    {
      $addFields: {
        cuisineMatches: {
          $size: {
            $setIntersection: [{ $ifNull: ['$cuisine', []] }, cuisinePreferences]
          }
        },
        itemMatches: {
          $size: {
            $setIntersection: [
              { $map: { input: '$menuItems', as: 'item', in: '$$item.name' } },
              itemPreferences
            ]
          }
        }
      }
    },
    {
      $addFields: {
        recommendationScore: {
          $add: [
            { $multiply: ['$cuisineMatches', 35] },
            { $multiply: ['$itemMatches', 20] },
            { $multiply: [{ $ifNull: ['$rating', 0] }, 8] },
            { $multiply: [{ $ln: { $add: [{ $ifNull: ['$popularity', 0] }, 1] } }, 6] }
          ]
        }
      }
    },
    { $sort: { recommendationScore: -1, rating: -1, popularity: -1 } },
    { $limit: safeLimit },
    {
      $project: {
        name: 1,
        city: 1,
        address: 1,
        cuisine: 1,
        rating: 1,
        priceRange: 1,
        estimatedDeliveryTime: 1,
        isVegOnly: 1,
        popularity: 1,
        image: 1,
        recommendationScore: { $round: ['$recommendationScore', 2] },
        cuisineMatches: 1,
        itemMatches: 1
      }
    }
  ];

  return Restaurant.aggregate(pipeline);
};

module.exports = { updateUserPreferences, getRecommendations };
