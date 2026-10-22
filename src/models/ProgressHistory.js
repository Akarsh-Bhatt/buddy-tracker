import mongoose from 'mongoose';

/**
 * ProgressHistory Schema
 * Audit history collection logging every progress sync event for auditability and streak verification.
 */
const progressHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course ID is required'],
      index: true
    },
    completedLectures: {
      type: Number,
      required: [true, 'Completed lectures count is required'],
      min: [0, 'Completed lectures cannot be negative']
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    source: {
      type: String,
      enum: ['extension', 'web_manual'],
      default: 'extension',
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes for fast audit and daily streak querying
progressHistorySchema.index({ userId: 1, timestamp: -1 });
progressHistorySchema.index({ userId: 1, courseId: 1, timestamp: -1 });

export const ProgressHistory = mongoose.model('ProgressHistory', progressHistorySchema);
