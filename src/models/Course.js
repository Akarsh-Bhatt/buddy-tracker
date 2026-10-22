import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      minlength: [2, 'Course title must be at least 2 characters'],
      maxlength: [200, 'Course title cannot exceed 200 characters']
    },
    udemyCourseId: {
      type: String,
      required: [true, 'Udemy Course ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    totalLectures: {
      type: Number,
      required: [true, 'Total lecture count is required'],
      min: [1, 'Course must have at least 1 lecture'],
      validate: {
        validator: Number.isInteger,
        message: 'Total lectures must be an integer'
      }
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

export const Course = mongoose.model('Course', courseSchema);
