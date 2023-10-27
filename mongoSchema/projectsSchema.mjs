import mongoose from 'mongoose';
import { users } from '../mongo.mjs';

export const projectsSchema = new mongoose.Schema({
  proj_id: {
    type: Number,
  },
  projLike: {
    type: Number,
    default: 0,
  },
  projFundGoal: {
    type: Number,
  },
  projFundCollect: {
    type: Number,
    default: 0,
  },
  projFundUserCount: {
    type: Number,
    default: 0,
  },
  userMade_id: {
    type: Number,
  },
  projName: {
    type: String,
    required: true,
  },
  projRegion: {
    type: Number,
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
  projPlace: {
    type: String,
  },
  projAddr: {
    type: String,
  },
  projDate: {
    type: [String],
  },
  projReward: [
    {
      projRewardName: String,
      projRewardAmount: Number,
      projRewardCount: Number,
      projRewardAvailable: {
        type: Number,
        default: function () {
          return this.projRewardCount;
        },
      },
    },
  ],
  projFundDate: [
    {
      projFundStartDate: String,
      projFundEndDate: String,
    },
  ],
  projStatus: {
    type: String,
    default: '0',
  },
  comment: {
    type: String,
  },
  QnA: {
    type: String,
  },
});
