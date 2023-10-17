import mongoose from 'mongoose';
import { projects } from '../mongo.mjs';

export const countProjectsSchema = new mongoose.Schema({
  proj_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'projects',
  },
  projLike: {
    type: Number,
  },
  projFundGoal: {
    type: String,
    required: true,
  },
  projFundCollect: {
    type: String,
  },
  projFundUserCount: {
    type: String,
  },
});
