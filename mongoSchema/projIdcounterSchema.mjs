import mongoose from 'mongoose';

export const projidcounterSchema = new mongoose.Schema({
  seq: { type: Number, default: 1 },
  seqUserId: { type: Number, default: 1 },
});
