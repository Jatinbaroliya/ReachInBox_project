export interface Email {
  _id: string;
  messageId: string;
  account: string;
  folder: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  html?: string;
  date: Date;
  category?: 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
  isRead: boolean;
  isFlagged: boolean;
  attachments: Array<{ filename: string; size: number }>;
  createdAt: Date;
  updatedAt: Date;
}