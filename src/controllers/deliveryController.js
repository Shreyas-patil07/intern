const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');
const { assignDeliveryPartner, releaseDeliveryPartner } = require('../services/deliveryAssignmentService');
const { emitDeliveryAssignmentChange } = require('../services/realtimeService');

exports.setStatus = async (req, res) => {
  try {
    const { available, latitude, longitude } = req.body;

    if (typeof available !== 'boolean') {
      return res.status(400).json({ success: false, message: 'available must be a boolean' });
    }

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    if (Number(latitude) < -90 || Number(latitude) > 90 || Number(longitude) < -180 || Number(longitude) > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const partner = await DeliveryPartner.findOneAndUpdate(
      { user: req.user._id },
      {
        available,
        currentLocation: {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)]
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('user', 'name email role');

    return res.status(200).json({
      success: true,
      message: available ? 'Delivery partner is now available' : 'Delivery partner is now unavailable',
      data: partner
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyAssignments = async (req, res) => {
  try {
    const orders = await Order.find({ assignedDeliveryPartner: req.user._id })
      .sort({ createdAt: -1 })
      .populate('restaurant', 'name city address location')
      .populate('items.menuItem', 'name price image');

    return res.status(200).json({ success: true, data: orders, count: orders.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.declineOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('restaurant');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.assignedDeliveryPartner || order.assignedDeliveryPartner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'This order is not assigned to you' });
    }
    if (['cancelled', 'delivered'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order can no longer be reassigned' });
    }

    const previousPartnerId = order.assignedDeliveryPartner;
    await releaseDeliveryPartner(previousPartnerId);

    order.deliveryAssignmentHistory.push(previousPartnerId);
    order.assignedDeliveryPartner = null;
    order.assignmentStatus = 'unassigned';
    await order.save();
    await emitDeliveryAssignmentChange({ order, partnerId: null, previousPartnerId });

    const assignment = await assignDeliveryPartner(order.restaurant.location, {
      excludePartnerIds: order.deliveryAssignmentHistory
    });

    if (!assignment) {
      return res.status(200).json({
        success: true,
        message: 'Order declined. No alternative delivery partner is currently available',
        data: order
      });
    }

    order.assignedDeliveryPartner = assignment.partner.user;
    order.assignmentStatus = 'assigned';
    order.assignmentDistanceMeters = assignment.distanceMeters;
    order.assignedAt = new Date();
    order.assignmentAttempts += 1;
    await order.save();
    await emitDeliveryAssignmentChange({ order, partnerId: assignment.partner.user, previousPartnerId });

    return res.status(200).json({
      success: true,
      message: 'Order declined and reassigned successfully',
      data: {
        order,
        reassignedPartner: {
          user: assignment.partner.user,
          distanceMeters: assignment.distanceMeters
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
