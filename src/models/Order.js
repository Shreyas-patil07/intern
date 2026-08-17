const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    items: [
      {
        menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 }
      }
    ],
    totalAmount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    surgeMultiplier: { type: Number, default: 1, min: 1 },
    surgeReason: { type: [String], default: [] },
    deliveryAddress: { type: String, required: true, trim: true },
    couponCode: { type: String, trim: true, uppercase: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    orderStatus: { type: String, enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'], default: 'pending' },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']
        },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        changedAt: { type: Date, default: Date.now }
      }
    ],
    refundRequested: { type: Boolean, default: false },
    fraudRiskScore: { type: Number, default: 0, min: 0 },
    isSuspicious: { type: Boolean, default: false, index: true },
    fraudReasons: { type: [String], default: [] },
    assignedDeliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    deliveryAssignmentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignmentStatus: { type: String, enum: ['unassigned', 'assigned', 'declined', 'completed'], default: 'unassigned' },
    assignmentDistanceMeters: { type: Number, default: null, min: 0 },
    assignedAt: { type: Date, default: null },
    assignmentAttempts: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

orderSchema.pre('validate', function (next) {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory.push({ status: this.orderStatus, changedBy: this.user });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
