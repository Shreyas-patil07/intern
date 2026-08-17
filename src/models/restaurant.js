const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    cuisine: {
      type: [String],
      default: [],
      index: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      index: true
    },
    priceRange: {
      type: Number,
      default: 2,
      min: 1,
      max: 4,
      index: true
    },
    estimatedDeliveryTime: {
      type: Number,
      default: 30,
      min: 1,
      index: true
    },
    isVegOnly: {
      type: Boolean,
      default: false,
      index: true
    },
    popularity: {
      type: Number,
      default: 0,
      min: 0,
      index: true
    },
    image: {
      type: String
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

restaurantSchema.index({ name: 'text', city: 'text', cuisine: 'text', address: 'text' });
restaurantSchema.index({ isApproved: 1, rating: -1, popularity: -1 });
restaurantSchema.index({ isApproved: 1, estimatedDeliveryTime: 1 });

module.exports = mongoose.model('Restaurant', restaurantSchema);
