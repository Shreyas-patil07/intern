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

const initializeRealtime = (socketServer) => {
  io = socketServer;

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join-order', (orderId) => {
      if (orderId) socket.join(`order:${orderId}`);
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
    data: {
      orderId: order._id,
      previousStatus,
      status: order.orderStatus,
      changedBy
    }
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

module.exports = { initializeRealtime, emitOrderStatusChange };
