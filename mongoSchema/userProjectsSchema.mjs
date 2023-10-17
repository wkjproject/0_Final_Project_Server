import mongoose from 'mongoose';
import { users, projects } from '../mongo.mjs';

export const userProjectsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
  },
  userLikeProject: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'projects',
  },
  userFundProject: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'projects',
  },
  userFundReward: {
    type: [String],
  },
  userMadeProject: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'projects',
  },
});
