import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    name: {
      type: String,
      default: 'Chrome Extension',
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    keyHash: {
      type: String,
      required: [true, 'Key hash is required'],
      unique: true,
      index: true
    },
    prefix: {
      type: String,
      required: [true, 'Key prefix is required'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.keyHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const ApiKey = mongoose.model('ApiKey', apiKeySchema);
