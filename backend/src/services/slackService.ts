import axios from 'axios';
import { IEmail } from '../models/Email';

export async function sendSlackNotification(email: IEmail) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('Slack webhook URL not configured');
    return;
  }

  const message = {
    text: `🎯 New Interested Email!`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 New Interested Email Received'
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*From:*\n${email.from}`
          },
          {
            type: 'mrkdwn',
            text: `*Account:*\n${email.account}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Subject:*\n${email.subject}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Preview:*\n${email.body.substring(0, 200)}...`
        }
      }
    ]
  };

  try {
    await axios.post(webhookUrl, message);
    console.log('✅ Slack notification sent');
  } catch (error) {
    console.error('❌ Slack notification error:', error);
  }
}