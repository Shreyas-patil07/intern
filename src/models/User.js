const mongoose = require('mongoose');

const preferenceEntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    count: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['user', 'admin', 'restaurant', 'delivery'],
      default: 'user'
    },
    isblocked: { type: Boolean, default: false },
    fraudRestrictedUntil: { type: Date, default: null },
    preferenceProfile: {
      cuisines: { type: [preferenceEntrySchema], default: [] },
      items: { type: [preferenceEntrySchema], default: [] },
      ordersCount: { type: Number, default: 0, min: 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
