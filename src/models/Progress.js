import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema(
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
      default: 0,
      min: [0, 'Completed lectures cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Completed lectures count must be an integer'
      }
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    completedLectureIds: {
      type: [String],
      default: []
    },
    history: {
      type: [
        {
          timestamp: {
            type: Date,
            default: Date.now,
            required: true
          },
          completedLectures: {
            type: Number,
            required: true,
            min: 0
          },
          source: {
            type: String,
            enum: ['extension', 'web_manual'],
            default: 'extension',
            required: true
          }
        }
      ],
      default: []
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

// Ensure a user only has one progress document per course
progressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const Progress = mongoose.model('Progress', progressSchema);
