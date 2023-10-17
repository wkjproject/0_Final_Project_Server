import mongoose from 'mongoose';

export const verifiCodeSchema = new mongoose.Schema({
  userMail: {
    type: String,
    required: true,
  },
  userMailVerifiNum: {
    type: String,
  },
  expires: {
    type: Date,
    default: Date.now,
    index: { expires: '3m' }, // 3분내로 삭제
  },
});
