import { Schema, model } from 'mongoose';

const GroupSchema = new Schema({
  gid: { type: Number, unique: true, required: true },
  lastActiveAt: { type: Date, default: Date.now }
});
 
export default model('Group', GroupSchema);
