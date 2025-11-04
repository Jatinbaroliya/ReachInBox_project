import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  isConnected: boolean;
  lastSyncDate?: Date;
  createdAt: Date;
}

const AccountSchema = new Schema<IAccount>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  host: { type: String, required: true },
  port: { type: Number, required: true },
  tls: { type: Boolean, default: true },
  isConnected: { type: Boolean, default: false },
  lastSyncDate: Date
}, { timestamps: true });

export default mongoose.model<IAccount>('Account', AccountSchema);