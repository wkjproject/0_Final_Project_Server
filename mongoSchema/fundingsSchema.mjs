import mongoose from 'mongoose';

export const fundingsSchema = new mongoose.Schema({
  funding_id: {
    type: String,
  },
  user_id: {
    type: Number,
  },
  project_id: {
    type: Number,
  },
  rewards: [
    {
      reward_id: String,
      price: Number,
      count: Number,
    },
  ],
  fundingDate: {
    type: String,
  },
  fundingStatus: {
    type: Number,
    default: 0,
  },
});
