const Order = require('../models/Order');
const SurgeSetting = require('../models/SurgeSetting');

const getSettings = async () => {
  let settings = await SurgeSetting.findOne({ singleton: 'default' });

  if (!settings) {
    settings = await SurgeSetting.create({
      singleton: 'default',
      demandRules: [
        { minOrdersLastHour: 5, multiplier: 1.2 },
        { minOrdersLastHour: 10, multiplier: 1.4 },
        { minOrdersLastHour: 20, multiplier: 1.75 }
      ]
    });
  }

  return settings;
};

const hourInRange = (hour, start, end) => {
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
};

const calculateDeliveryFee = async ({ city }) => {
  const settings = await getSettings();
  const now = new Date();
  const hour = now.getHours();

  let multiplier = 1;
  const reasons = [];

  if (!settings.enabled) {
    return {
      baseDeliveryFee: settings.baseDeliveryFee,
      deliveryFee: settings.baseDeliveryFee,
      surgeMultiplier: 1,
      demandOrdersLastHour: 0,
      reasons: ['Surge pricing disabled']
    };
  }

  if (hourInRange(hour, settings.peakHours.lunch.start, settings.peakHours.lunch.end)) {
    multiplier = Math.max(multiplier, settings.peakHours.lunch.multiplier);
    reasons.push('Lunch peak hour');
  }

  if (hourInRange(hour, settings.peakHours.dinner.start, settings.peakHours.dinner.end)) {
    multiplier = Math.max(multiplier, settings.peakHours.dinner.multiplier);
    reasons.push('Dinner peak hour');
  }

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const demandOrdersLastHour = city
    ? await Order.countDocuments({ createdAt: { $gte: since }, orderStatus: { $ne: 'cancelled' }, 'restaurant': { $exists: true } })
    : await Order.countDocuments({ createdAt: { $gte: since }, orderStatus: { $ne: 'cancelled' } });

  const matchingRules = settings.demandRules.filter(
    rule => demandOrdersLastHour >= rule.minOrdersLastHour
  );

  if (matchingRules.length) {
    const demandRule = matchingRules.reduce((best, rule) =>
      rule.minOrdersLastHour > best.minOrdersLastHour ? rule : best
    );
    multiplier = Math.max(multiplier, demandRule.multiplier);
    reasons.push(`High demand: ${demandOrdersLastHour} orders in the last hour`);
  }

  const regionMultiplier = Number(settings.regionMultipliers.get(city || '')) || 1;
  if (regionMultiplier > 1) {
    multiplier = Math.max(multiplier, regionMultiplier);
    reasons.push(`${city} regional multiplier`);
  }

  const deliveryFee = Math.round(settings.baseDeliveryFee * multiplier * 100) / 100;

  return {
    baseDeliveryFee: settings.baseDeliveryFee,
    deliveryFee,
    surgeMultiplier: multiplier,
    demandOrdersLastHour,
    reasons
  };
};

module.exports = { calculateDeliveryFee, getSettings };
