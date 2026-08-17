const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Restaurant = require('../models/restaurant');
const { assessOrder } = require('../services/fraudService');
const { calculateDeliveryFee } = require('../services/surgePricingService');
const { assignDeliveryPartner, releaseDeliveryPartner } = require('../services/deliveryAssignmentService');
const { emitOrderStatusChange, emitDeliveryAssignmentChange } = require('../services/realtimeService');
const { updateUserPreferences } = require('../services/recommendationService');

const ALLOWED_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: []
};

const calculateDelivery = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ success: false, message: 'restaurantId is required' });

    const restaurant = await Restaurant.findById(restaurantId).select('city isApproved');
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    if (!restaurant.isApproved) return res.status(400).json({ success: false, message: 'Restaurant is not approved yet' });

    const pricing = await calculateDeliveryFee({ city: restaurant.city });
    return res.status(200).json({ success: true, data: { restaurantId, city: restaurant.city, ...pricing } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const assignOrder = async (order) => {
  const restaurant = await Restaurant.findById(order.restaurant).select('location');
  const assignment = await assignDeliveryPartner(restaurant?.location);

  if (!assignment) return null;

  order.assignedDeliveryPartner = assignment.partner.user;
  order.assignmentStatus = 'assigned';
  order.assignmentDistanceMeters = assignment.distanceMeters;
  order.assignedAt = new Date();
  order.assignmentAttempts += 1;
  await order.save();

  await emitDeliveryAssignmentChange({ order, partnerId: assignment.partner.user });
  return assignment;
};

const placeOrder = async (req, res) => {
  try {
    const { deliveryAddress, couponCode } = req.body;
    if (!deliveryAddress || !deliveryAddress.trim()) return res.status(400).json({ success: false, message: 'Delivery address is required' });

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.menuItem').populate('restaurant');
    if (!cart || cart.items.length === 0) return res.status(400).json({ success: false, message: 'Your cart is empty' });
    if (!cart.restaurant.isApproved) return res.status(400).json({ success: false, message: 'Restaurant is not approved yet. Please try again later.' });

    const items = cart.items.map(item => ({ menuItem: item.menuItem._id, name: item.menuItem.name, price: item.menuItem.price, quantity: item.quantity }));
    const totalAmount = cart.items.reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
    const pricing = await calculateDeliveryFee({ city: cart.restaurant.city });

    const order = await Order.create({
      user: req.user._id,
      restaurant: cart.restaurant._id,
      items,
      totalAmount,
      deliveryFee: pricing.deliveryFee,
      surgeMultiplier: pricing.surgeMultiplier,
      surgeReason: pricing.reasons,
      deliveryAddress: deliveryAddress.trim(),
      couponCode: couponCode?.trim() || undefined
    });

    await Cart.findOneAndDelete({ user: req.user._id });
    const fraudAssessment = await assessOrder({ order, couponCode });
    const assignment = await assignOrder(order);
    await updateUserPreferences(req.user._id, order._id);
    await emitOrderStatusChange({ order, previousStatus: null, changedBy: req.user._id });

    return res.status(201).json({
      success: true,
      message: fraudAssessment.suspicious ? 'Order placed and flagged for fraud review' : 'Order placed successfully',
      data: order,
      pricing,
      fraud: { riskScore: fraudAssessment.riskScore, suspicious: fraudAssessment.suspicious, reasons: fraudAssessment.reasons },
      deliveryAssignment: assignment
        ? { status: 'assigned', partnerId: assignment.partner.user, distanceMeters: assignment.distanceMeters }
        : { status: 'unassigned', reason: 'No available delivery partner with a valid location' }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const order = await Order.findById(req.params.orderId).populate('restaurant', 'owner');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isAdmin = req.user.role === 'admin';
    const isRestaurantOwner = req.user.role === 'restaurant' && order.restaurant.owner.toString() === req.user._id.toString();
    const isAssignedPartner = req.user.role === 'delivery' && order.assignedDeliveryPartner?.toString() === req.user._id.toString();

    if (!isAdmin && !isRestaurantOwner && !isAssignedPartner) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this order' });
    }

    const restaurantStatuses = ['confirmed', 'preparing', 'cancelled'];
    const deliveryStatuses = ['out_for_delivery', 'delivered'];

    if (!isAdmin && isRestaurantOwner && !restaurantStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: 'Restaurant can only set confirmed, preparing, or cancelled' });
    }

    if (!isAdmin && isAssignedPartner && !deliveryStatuses.includes(status)) {
      return res.status(403).json({ success: false, message: 'Delivery partner can only set out_for_delivery or delivered' });
    }

    const previousStatus = order.orderStatus;
    if (previousStatus === status) return res.status(400).json({ success: false, message: 'Order is already in this status' });
    if (!STATUS_TRANSITIONS[previousStatus]?.includes(status)) {
      return res.status(409).json({ success: false, message: `Invalid status transition: ${previousStatus} -> ${status}` });
    }

    order.orderStatus = status;
    order.statusHistory.push({ status, changedBy: req.user._id, changedAt: new Date() });

    if (status === 'delivered' || status === 'cancelled') {
      const partnerId = order.assignedDeliveryPartner;
      order.assignmentStatus = 'completed';
      order.assignedDeliveryPartner = null;
      if (partnerId) await releaseDeliveryPartner(partnerId);
    }

    await order.save();
    const notification = await emitOrderStatusChange({ order, previousStatus, changedBy: req.user._id });

    return res.status(200).json({ success: true, message: 'Order status updated successfully', data: order, notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const mockPayment = async (req, res) => {
  try {
    const orderId = req.body.orderId || req.params.orderId;
    if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'You are not authorized to pay for this order' });
    if (order.isSuspicious) return res.status(403).json({ success: false, message: 'Order is pending fraud review before payment can be completed' });
    if (order.orderStatus !== 'pending') return res.status(400).json({ success: false, message: 'Only pending orders can be paid' });

    const previousStatus = order.orderStatus;
    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.statusHistory.push({ status: 'confirmed', changedBy: req.user._id, changedAt: new Date() });
    await order.save();
    await emitOrderStatusChange({ order, previousStatus, changedBy: req.user._id });

    return res.status(200).json({ success: true, message: 'Mock payment successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'You are not authorized to cancel this order' });
    if (!['pending', 'confirmed'].includes(order.orderStatus)) return res.status(400).json({ success: false, message: 'This order can no longer be cancelled' });

    const previousStatus = order.orderStatus;
    const partnerId = order.assignedDeliveryPartner;
    order.orderStatus = 'cancelled';
    order.assignmentStatus = 'completed';
    order.assignedDeliveryPartner = null;
    order.statusHistory.push({ status: 'cancelled', changedBy: req.user._id, changedAt: new Date() });
    if (partnerId) await releaseDeliveryPartner(partnerId);
    await order.save();

    const fraudAssessment = await assessOrder({ order });
    await emitOrderStatusChange({ order, previousStatus, changedBy: req.user._id });
    await emitDeliveryAssignmentChange({ order, partnerId: null, previousPartnerId: partnerId });

    return res.status(200).json({ success: true, message: 'Order cancelled successfully', data: order, fraud: fraudAssessment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const requestRefund = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'You are not authorized to request a refund' });
    if (order.paymentStatus !== 'paid') return res.status(400).json({ success: false, message: 'Only paid orders can have refund requests' });
    if (order.refundRequested) return res.status(400).json({ success: false, message: 'Refund request already exists' });

    order.refundRequested = true;
    await order.save();
    const fraudAssessment = await assessOrder({ order });
    return res.status(200).json({ success: true, message: 'Refund request submitted', fraud: fraudAssessment });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('restaurant', 'name city address image location')
      .populate('items.menuItem', 'name price image')
      .populate('assignedDeliveryPartner', 'name email role');
    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('restaurant', 'name city address image location owner')
      .populate('items.menuItem', 'name price image')
      .populate('user', 'name email')
      .populate('assignedDeliveryPartner', 'name email role');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const isOwner = order.user._id.toString() === req.user._id.toString();
    const isAssignedPartner = order.assignedDeliveryPartner?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isRestaurantOwner = req.user.role === 'restaurant' && order.restaurant.owner?.toString() === req.user._id.toString();

    if (!isOwner && !isAssignedPartner && !isAdmin && !isRestaurantOwner) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this order' });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getRestaurantOrders = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return res.status(404).json({ success: false, message: "You don't have a restaurant registered" });
    const orders = await Order.find({ restaurant: restaurant._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('items.menuItem', 'name price image')
      .populate('assignedDeliveryPartner', 'name email role');
    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  calculateDelivery,
  placeOrder,
  updateOrderStatus,
  mockPayment,
  cancelOrder,
  requestRefund,
  getMyOrders,
  getOrderById,
  getRestaurantOrders
};
