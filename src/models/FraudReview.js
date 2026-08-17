const mongoose = require('mongoose');

const fraudReviewSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0
    },
    reasons: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    action: {
      type: String,
      enum: ['review', 'approve', 'reject', 'restrict_user'],
      default: 'review'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('FraudReview', fraudReviewSchema);
