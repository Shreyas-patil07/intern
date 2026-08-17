const mongoose = require('mongoose');

const surgeSettingSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: 'default',
      unique: true
    },
    baseDeliveryFee: {
      type: Number,
      default: 40,
      min: 0
    },
    peakHours: {
      lunch: {
        start: { type: Number, default: 12, min: 0, max: 23 },
        end: { type: Number, default: 15, min: 0, max: 23 },
        multiplier: { type: Number, default: 1.25, min: 1, max: 5 }
      },
      dinner: {
        start: { type: Number, default: 19, min: 0, max: 23 },
        end: { type: Number, default: 22, min: 0, max: 23 },
        multiplier: { type: Number, default: 1.5, min: 1, max: 5 }
      }
    },
    demandRules: [
      {
        minOrdersLastHour: { type: Number, required: true, min: 0 },
        multiplier: { type: Number, required: true, min: 1, max: 5 }
      }
    ],
    regionMultipliers: {
      type: Map,
      of: Number,
      default: {}
    },
    enabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SurgeSetting', surgeSettingSchema);
