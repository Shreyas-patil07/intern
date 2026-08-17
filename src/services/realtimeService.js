const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

let io = null;

const statusMessages = {
  pending: 'Order placed',
  confirmed: 'Restaurant accepted your order',
  preparing: 'Your food is being prepared',
  out_for_delivery: 'Your order is out for delivery',
  delivered: 'Your order has been delivered',
  cancelled: 'Your order has been cancelled'
};

const getSocketToken = (socket) => socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

const initializeRealtime = (socketServer) => {
  io = socketServer;

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id role isblocked fraudRestrictedUntil');

      if (!user || user.isblocked) return next(new Error('Access denied'));
      if (user.fraudRestrictedUntil && user.fraudRestrictedUntil > new Date()) {
        return next(new Error('Account temporarily restricted'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid socket token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    socket.join(`user:${userId}`);

    socket.on('join-order', async (orderId) => {
      try {
        const order = await Order.findById(orderId).populate('restaurant', 'owner');
        if (!order) return socket.emit('join-order-error', { message: 'Order not found' });

        const isOwner = order.user.toString() === userId;
        const isAssignedPartner = order.assignedDeliveryPartner?.toString() === userId;
        const isAdmin = socket.user.role === 'admin';
        const isRestaurantOwner = socket.user.role === 'restaurant' && order.restaurant?.owner?.toString() === userId;

        if (!isOwner && !isAssignedPartner && !isAdmin && !isRestaurantOwner) {
          return socket.emit('join-order-error', { message: 'Not authorized for this order' });
        }

        socket.join(`order:${orderId}`);
      } catch (error) {
        socket.emit('join-order-error', { message: 'Unable to join order room' });
      }
    });
  });
};

const emitOrderStatusChange = async ({ order, previousStatus, changedBy }) => {
  const message = statusMessages[order.orderStatus] || `Order status changed to ${order.orderStatus}`;

  const notification = await Notification.create({
    user: order.user,
    order: order._id,
    type: 'order_status',
    title: 'Order update',
    message,
    data: { orderId: order._id, previousStatus, status: order.orderStatus, changedBy }
  });

  const payload = {
    notificationId: notification._id,
    orderId: order._id,
    previousStatus,
    status: order.orderStatus,
    message,
    notification
  };

  if (io) {
    io.to(`user:${order.user}`).emit('order-status-updated', payload);
    io.to(`order:${order._id}`).emit('order-status-updated', payload);
  }

  return notification;
};

const emitDeliveryAssignmentChange = async ({ order, partnerId, previousPartnerId = null }) => {
  const message = partnerId
    ? 'A delivery partner has been assigned to your order'
    : 'Your order is waiting for a delivery partner';

  const notification = await Notification.create({
    user: order.user,
    order: order._id,
    type: 'delivery_assignment',
    title: 'Delivery update',
    message,
    data: { orderId: order._id, partnerId, previousPartnerId }
  });

  const payload = {
    notificationId: notification._id,
    orderId: order._id,
    partnerId,
    previousPartnerId,
    message,
    notification
  };

  if (io) {
    io.to(`user:${order.user}`).emit('delivery-assignment-updated', payload);
    io.to(`order:${order._id}`).emit('delivery-assignment-updated', payload);
    if (partnerId) io.to(`user:${partnerId}`).emit('delivery-assignment-updated', payload);
  }

  return notification;
};

module.exports = { initializeRealtime, emitOrderStatusChange, emitDeliveryAssignmentChange };
