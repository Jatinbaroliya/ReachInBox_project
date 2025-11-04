import axios from 'axios';
import { IEmail } from '../models/Email';

export async function triggerWebhook(email: IEmail) {
  const webhookUrl = process.env.EXTERNAL_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('External webhook URL not configured');
    return;
  }

  const payload = {
    event: 'email.interested',
    data: {
      messageId: email.messageId,
      account: email.account,
      from: email.from,
      subject: email.subject,
      body: email.body,
      date: email.date,
      category: email.category
    },
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Webhook triggered');
  } catch (error) {
    console.error('❌ Webhook trigger error:', error);
  }
}