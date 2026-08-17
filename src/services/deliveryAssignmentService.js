const DeliveryPartner = require('../models/DeliveryPartner');

const assignDeliveryPartner = async (restaurantLocation, { excludePartnerIds = [] } = {}) => {
  if (!restaurantLocation?.coordinates || restaurantLocation.coordinates.length !== 2) return null;

  const candidates = await DeliveryPartner.aggregate([
    {
      $geoNear: {
        near: restaurantLocation,
        distanceField: 'distanceMeters',
        spherical: true,
        query: {
          available: true,
          $expr: { $lt: ['$currentOrdersCount', '$maxOrders'] },
          ...(excludePartnerIds.length ? { user: { $nin: excludePartnerIds } } : {})
        }
      }
    },
    { $sort: { distanceMeters: 1, currentOrdersCount: 1, averageDeliveryMinutes: 1 } },
    { $limit: 10 }
  ]);

  for (const candidate of candidates) {
    const partner = await DeliveryPartner.findOneAndUpdate(
      {
        _id: candidate._id,
        available: true,
        $expr: { $lt: ['$currentOrdersCount', '$maxOrders'] }
      },
      {
        $inc: { currentOrdersCount: 1 },
        $set: { lastAssignedAt: new Date() }
      },
      { new: true }
    );

    if (!partner) continue;

    if (partner.currentOrdersCount >= partner.maxOrders) {
      await DeliveryPartner.updateOne({ _id: partner._id }, { $set: { available: false } });
      partner.available = false;
    }

    return {
      partner,
      distanceMeters: Math.round(candidate.distanceMeters)
    };
  }

  return null;
};

const releaseDeliveryPartner = async (partnerId) => {
  return DeliveryPartner.findOneAndUpdate(
    { user: partnerId },
    [
      { $set: { currentOrdersCount: { $max: [{ $subtract: ['$currentOrdersCount', 1] }, 0] } } },
      { $set: { available: { $lt: ['$currentOrdersCount', '$maxOrders'] } } }
    ],
    { new: true }
  );
};

module.exports = { assignDeliveryPartner, releaseDeliveryPartner };
