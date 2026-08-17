const DeliveryPartner = require('../models/DeliveryPartner');

const assignDeliveryPartner = async (restaurantLocation, { excludePartnerIds = [] } = {}) => {
  if (!restaurantLocation?.coordinates || restaurantLocation.coordinates.length !== 2) {
    return null;
  }

  const candidates = await DeliveryPartner.aggregate([
    {
      $geoNear: {
        near: restaurantLocation,
        distanceField: 'distanceMeters',
        spherical: true,
        query: {
          available: true,
          $expr: { $lt: ['$currentOrdersCount', '$maxOrders'] },
          ...(excludePartnerIds.length
            ? { user: { $nin: excludePartnerIds } }
            : {})
        }
      }
    },
    { $sort: { distanceMeters: 1, currentOrdersCount: 1, averageDeliveryMinutes: 1 } },
    { $limit: 1 }
  ]);

  if (!candidates.length) return null;

  const candidate = candidates[0];
  const partner = await DeliveryPartner.findById(candidate._id);

  if (!partner) return null;

  partner.currentOrdersCount += 1;
  partner.lastAssignedAt = new Date();
  if (partner.currentOrdersCount >= partner.maxOrders) {
    partner.available = false;
  }
  await partner.save();

  return {
    partner,
    distanceMeters: Math.round(candidate.distanceMeters)
  };
};

const releaseDeliveryPartner = async (partnerId) => {
  const partner = await DeliveryPartner.findById(partnerId);
  if (!partner) return null;

  partner.currentOrdersCount = Math.max(partner.currentOrdersCount - 1, 0);
  if (partner.currentOrdersCount < partner.maxOrders) {
    partner.available = true;
  }
  await partner.save();
  return partner;
};

module.exports = { assignDeliveryPartner, releaseDeliveryPartner };
