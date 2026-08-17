const User = require('../models/User');
const Restaurant = require('../models/restaurant');
const Order = require('../models/Order');
const DeliveryPartner = require('../models/DeliveryPartner');
const FraudReview = require('../models/FraudReview');
const SurgeSetting = require('../models/SurgeSetting');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.status(200).json({ success: true, data: users, count: users.length });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isblocked = !user.isblocked;
    await user.save();
    return res.status(200).json({ success: true, message: `User ${user.isblocked ? 'blocked' : 'unblocked'} successfully`, data: user });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.approveRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    restaurant.isApproved = !restaurant.isApproved;
    await restaurant.save();
    return res.status(200).json({ success: true, message: `Restaurant ${restaurant.isApproved ? 'approved' : 'disapproved'} successfully`, data: restaurant });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { owner, name, city, address } = req.body;
    if (!owner || !name || !city || !address) return res.status(400).json({ success: false, message: 'owner, name, city and address are required' });
    const ownerUser = await User.findById(owner);
    if (!ownerUser || ownerUser.role !== 'restaurant') return res.status(400).json({ success: false, message: 'owner must be an existing restaurant user' });
    if (await Restaurant.findOne({ owner })) return res.status(400).json({ success: false, message: 'Owner already has a restaurant' });
    const restaurant = await Restaurant.create({ ...req.body, isApproved: req.body.isApproved ?? true });
    return res.status(201).json({ success: true, message: 'Restaurant created successfully by admin', data: restaurant });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    const allowedFields = ['name','city','address','cuisine','rating','priceRange','estimatedDeliveryTime','isVegOnly','popularity','image','isApproved','location'];
    for (const field of allowedFields) if (req.body[field] !== undefined) restaurant[field] = req.body[field];
    await restaurant.save();
    return res.status(200).json({ success: true, message: 'Restaurant updated successfully by admin', data: restaurant });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').populate('restaurant', 'name').populate('assignedDeliveryPartner', 'name email');
    return res.status(200).json({ success: true, data: orders, count: orders.length });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.getPlatformStatistics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRestaurants = await Restaurant.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalDeliveryPartners = await DeliveryPartner.countDocuments();
    const revenueResult = await Order.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, totalRevenue: { $sum: { $add: ['$totalAmount', '$deliveryFee'] } } } }]);
    return res.status(200).json({ success: true, data: { totalUsers, totalRestaurants, totalOrders, totalDeliveryPartners, totalRevenue: revenueResult[0]?.totalRevenue || 0 } });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.getFraudOrders = async (req, res) => {
  try {
    const reviews = await FraudReview.find({ status: 'pending' }).sort({ riskScore: -1, createdAt: -1 }).populate('order').populate('user', 'name email role isblocked fraudRestrictedUntil');
    return res.status(200).json({ success: true, data: reviews, count: reviews.length });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

const updateFraudReview = async (req, res, nextStatus, action) => {
  try {
    const review = await FraudReview.findOne({ order: req.params.orderId });
    if (!review) return res.status(404).json({ success: false, message: 'Fraud review not found' });
    const order = await Order.findById(review.order);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    review.status = nextStatus; review.action = action; review.reviewedBy = req.user._id; review.reviewedAt = new Date(); await review.save();
    order.isSuspicious = nextStatus === 'rejected';
    if (nextStatus === 'approved') { order.fraudReasons = []; order.fraudRiskScore = 0; }
    if (nextStatus === 'rejected') order.orderStatus = 'cancelled';
    await order.save();
    return res.status(200).json({ success: true, message: `Fraud review ${nextStatus}`, data: { review, order } });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};
exports.approveFraudOrder = (req, res) => updateFraudReview(req, res, 'approved', 'approve');
exports.rejectFraudOrder = (req, res) => updateFraudReview(req, res, 'rejected', 'reject');

exports.restrictFraudUser = async (req, res) => {
  try {
    const review = await FraudReview.findOne({ order: req.params.orderId });
    if (!review) return res.status(404).json({ success: false, message: 'Fraud review not found' });
    const durationHours = Math.min(Math.max(Number(req.body.hours) || 24, 1), 168);
    const user = await User.findById(review.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.fraudRestrictedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    await user.save();
    review.status = 'approved'; review.action = 'restrict_user'; review.reviewedBy = req.user._id; review.reviewedAt = new Date(); await review.save();
    return res.status(200).json({ success: true, message: `User temporarily restricted for ${durationHours} hours`, data: { userId: user._id, restrictedUntil: user.fraudRestrictedUntil } });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.getSurgeSettings = async (req, res) => {
  try {
    let settings = await SurgeSetting.findOne({ singleton: 'default' });
    if (!settings) settings = await SurgeSetting.create({ singleton: 'default', demandRules: [{ minOrdersLastHour: 5, multiplier: 1.2 }, { minOrdersLastHour: 10, multiplier: 1.4 }, { minOrdersLastHour: 20, multiplier: 1.75 }] });
    return res.status(200).json({ success: true, data: settings });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.updateSurgeSettings = async (req, res) => {
  try {
    const allowed = ['baseDeliveryFee','peakHours','demandRules','regionMultipliers','enabled'];
    const update = {};
    for (const field of allowed) if (req.body[field] !== undefined) update[field] = req.body[field];
    const settings = await SurgeSetting.findOneAndUpdate({ singleton: 'default' }, { $set: update, $setOnInsert: { singleton: 'default' } }, { new: true, upsert: true, runValidators: true });
    return res.status(200).json({ success: true, message: 'Surge settings updated successfully', data: settings });
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
};

exports.getDeliveryPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find().sort({ available: -1, currentOrdersCount: 1 }).populate('user', 'name email role isblocked');
    return res.status(200).json({ success: true, data: partners, count: partners.length });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

exports.setDeliveryPartnerAvailability = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findOneAndUpdate(
      { user: req.params.userId },
      { available: Boolean(req.body.available) },
      { new: true }
    );
    if (!partner) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    return res.status(200).json({ success: true, data: partner });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};
