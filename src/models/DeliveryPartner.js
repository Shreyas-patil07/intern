const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    available: {
      type: Boolean,
      default: false,
      index: true
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    currentOrdersCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxOrders: {
      type: Number,
      default: 2,
      min: 1
    },
    averageDeliveryMinutes: {
      type: Number,
      default: 30,
      min: 1
    },
    lastAssignedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

deliveryPartnerSchema.index({ currentLocation: '2dsphere' });
deliveryPartnerSchema.index({ available: 1, currentOrdersCount: 1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
