import mongoose from 'mongoose';
import { users } from '../mongo.mjs';

export const projectsSchema = new mongoose.Schema({
  userMade_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
  },
  projName: {
    type: String,
    required: true,
  },
  projMainImgPath: {
    type: String,
  },
  projDetailImgPath: {
    type: [String],
  },
  projIntro: {
    type: String,
  },
  projDesc: {
    type: String,
  },
  projTag: {
    type: Number,
    default: 0,
  },
  projReward: [
    {
      projRewardName: String,
      projRewardAmount: Number,
    },
  ],
  projFundDate: [
    {
      projFundStartDate: Date,
      projFundEndDate: Date,
    },
  ],
  projStatus: {
    type: Number,
  },
});
