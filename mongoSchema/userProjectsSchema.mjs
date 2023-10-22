import mongoose from 'mongoose';

export const userProjectsSchema = new mongoose.Schema({
  users_id: {
    type: Number,
  },
  userLikeProject: {
    type: [Number],
  },
  userFundProject: {
    type: [Number],
  },
  userFundReward: [
    {
      projRewardName: {
        type: String,
      },
    },
  ],
  userMadeProject: {
    type: [Number],
  },
});
