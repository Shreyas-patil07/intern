const Order = require('../models/Order');
const FraudReview = require('../models/FraudReview');

const RISK_THRESHOLD = 50;

const scoreOrderRisk = async ({ userId, orderId, couponCode }) => {
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [recentOrders, recentCancellations, recentCouponUsage, recentRefunds] = await Promise.all([
    Order.countDocuments({
      user: userId,
      _id: { $ne: orderId },
      createdAt: { $gte: tenMinutesAgo }
    }),
    Order.countDocuments({
      user: userId,
      orderStatus: 'cancelled',
      updatedAt: { $gte: oneDayAgo }
    }),
    couponCode
      ? Order.countDocuments({
          user: userId,
          couponCode,
          createdAt: { $gte: oneDayAgo }
        })
      : 0,
    Order.countDocuments({
      user: userId,
      refundRequested: true,
      updatedAt: { $gte: sevenDaysAgo }
    })
  ]);

  let riskScore = 0;
  const reasons = [];

  if (recentOrders >= 2) {
    riskScore += 40;
    reasons.push(`Multiple orders in a short period (${recentOrders + 1} in 10 minutes)`);
  }

  if (recentCancellations >= 2) {
    riskScore += 25;
    reasons.push(`Repeated cancellations (${recentCancellations} in 24 hours)`);
  }

  if (recentCouponUsage >= 3) {
    riskScore += 20;
    reasons.push(`Abnormal coupon usage (${recentCouponUsage + 1} uses in 24 hours)`);
  }

  if (recentRefunds >= 2) {
    riskScore += 30;
    reasons.push(`Excessive refund requests (${recentRefunds} in 7 days)`);
  }

  return {
    riskScore,
    reasons,
    suspicious: riskScore >= RISK_THRESHOLD
  };
};

const assessOrder = async ({ order, couponCode }) => {
  const result = await scoreOrderRisk({
    userId: order.user,
    orderId: order._id,
    couponCode
  });

  order.fraudRiskScore = result.riskScore;
  order.isSuspicious = result.suspicious;
  order.fraudReasons = result.reasons;
  await order.save();

  if (result.suspicious) {
    await FraudReview.findOneAndUpdate(
      { order: order._id },
      {
        order: order._id,
        user: order.user,
        riskScore: result.riskScore,
        reasons: result.reasons,
        status: 'pending',
        action: 'review'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return result;
};

module.exports = {
  RISK_THRESHOLD,
  scoreOrderRisk,
  assessOrder
};
