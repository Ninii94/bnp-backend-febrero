
import mongoose from 'mongoose';

const resetTimestampSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export const ResetTimestamp = mongoose.model('ResetTimestamp', resetTimestampSchema);