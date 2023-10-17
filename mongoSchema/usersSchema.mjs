import mongoose from 'mongoose';

export const usersSchema = new mongoose.Schema({
  userName: {
    type: String,
  },
  userMail: {
    type: String,
    required: true,
  },
  userPassword: {
    type: String,
  },
  userPhoneNum: {
    type: String,
  },
  userAddr: {
    type: String,
  },
  role: {
    type: Number,
    default: 0,
  },
  token: {
    type: String,
  },
  tokenExp: {
    type: Date,
  },
});
