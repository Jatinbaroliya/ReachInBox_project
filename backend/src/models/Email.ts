import mongoose, { Schema, Document } from 'mongoose';

export interface IEmail extends Document {
  messageId: string;
  account: string;
  folder: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  html: string;
  date: Date;
  category?: 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
  isRead: boolean;
  isFlagged: boolean;
  attachments: Array<{ filename: string; size: number }>;
  createdAt: Date;
  updatedAt: Date;
}

const EmailSchema = new Schema<IEmail>({
  messageId: { type: String, required: true, unique: true },
  account: { type: String, required: true, index: true },
  folder: { type: String, required: true, index: true },
  from: { type: String, required: true },
  to: [String],
  subject: { type: String, required: true },
  body: { type: String, required: true },
  html: String,
  date: { type: Date, required: true },
  category: {
    type: String,
    enum: ['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office'],
    index: true
  },
  isRead: { type: Boolean, default: false },
  isFlagged: { type: Boolean, default: false },
  attachments: [{
    filename: String,
    size: Number
  }]
}, { timestamps: true });

// Indexes for performance
EmailSchema.index({ account: 1, folder: 1, date: -1 });
EmailSchema.index({ category: 1, date: -1 });

export default mongoose.model<IEmail>('Email', EmailSchema);