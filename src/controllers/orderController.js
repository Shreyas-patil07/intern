const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Restaurant = require('../models/restaurant');
const { assessOrder } = require('../services/fraudService');

const placeOrder = async (req, res) => {
  try {
    const { deliveryAddress, couponCode } = req.body;

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required'
      });
    }

    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.menuItem')
      .populate('restaurant');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    if (!cart.restaurant.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant is not approved yet. Please try again later.'
      });
    }

    const items = cart.items.map((item) => ({
      menuItem: item.menuItem._id,
      name: item.menuItem.name,
      price: item.menuItem.price,
      quantity: item.quantity
    }));

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.menuItem.price * item.quantity,
      0
    );

    const order = await Order.create({
      user: req.user._id,
      restaurant: cart.restaurant._id,
      items,
      totalAmount,
      deliveryAddress: deliveryAddress.trim(),
      couponCode: couponCode?.trim() || undefined
    });

    await Cart.findOneAndDelete({ user: req.user._id });

    const fraudAssessment = await assessOrder({ order, couponCode });

    return res.status(201).json({
      success: true,
      message: fraudAssessment.suspicious
        ? 'Order placed and flagged for fraud review'
        : 'Order placed successfully',
      data: order,
      fraud: {
        riskScore: fraudAssessment.riskScore,
        suspicious: fraudAssessment.suspicious,
        reasons: fraudAssessment.reasons
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const mockPayment = async (req, res) => {
  try {
    const orderId = req.body.orderId || req.params.orderId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required'
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to pay for this order'
      });
    }

    if (order.isSuspicious) {
      return res.status(403).json({
        success: false,
        message: 'Order is pending fraud review before payment can be completed'
      });
    }

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Mock payment successful'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this order'
      });
    }

    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'This order can no longer be cancelled'
      });
    }

    order.orderStatus = 'cancelled';
    await order.save();

    const fraudAssessment = await assessOrder({ order });

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
      fraud: {
        riskScore: fraudAssessment.riskScore,
        suspicious: fraudAssessment.suspicious,
        reasons: fraudAssessment.reasons
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const requestRefund = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to request a refund' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Only paid orders can have refund requests' });
    }

    if (order.refundRequested) {
      return res.status(400).json({ success: false, message: 'Refund request already exists' });
    }

    order.refundRequested = true;
    await order.save();

    const fraudAssessment = await assessOrder({ order });

    return res.status(200).json({
      success: true,
      message: 'Refund request submitted',
      fraud: {
        riskScore: fraudAssessment.riskScore,
        suspicious: fraudAssessment.suspicious,
        reasons: fraudAssessment.reasons
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('restaurant', 'name city address image')
      .populate('items.menuItem', 'name price image');

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getRestaurantOrders = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "You don't have a restaurant registered"
      });
    }

    const orders = await Order.find({ restaurant: restaurant._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('items.menuItem', 'name price image');

    return res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  placeOrder,
  mockPayment,
  cancelOrder,
  requestRefund,
  getMyOrders,
  getRestaurantOrders
};
