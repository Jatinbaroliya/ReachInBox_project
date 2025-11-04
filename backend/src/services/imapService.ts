import Imap from 'imap';
import { simpleParser } from 'mailparser';
import Email from '../models/Email';
import { indexEmail } from './elasticsearchService';
import { categorizeEmail } from './aiCategorizationService';
import { sendSlackNotification } from './slackService';
import { triggerWebhook } from './webhookService';
import { io } from '../server';

interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

const imapConnections: Map<string, Imap> = new Map();

export async function startImapSync() {
  const accounts = process.env.IMAP_ACCOUNTS!.split(',');
  const passwords = process.env.IMAP_PASSWORDS!.split(',');
  const hosts = process.env.IMAP_HOSTS!.split(',');
  const ports = process.env.IMAP_PORTS!.split(',').map(Number);

  for (let i = 0; i < accounts.length; i++) {
    const config: ImapConfig = {
      user: accounts[i].trim(),
      password: passwords[i].trim(),
      host: hosts[i].trim(),
      port: ports[i],
      tls: true
    };

    await connectAndSync(config);
  }
}

async function connectAndSync(config: ImapConfig) {
  const imap = new Imap(config);

  imap.once('ready', () => {
    console.log(`✅ IMAP connected: ${config.user}`);

    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      imap.search(['ALL', ['SINCE', thirtyDaysAgo]], (err, results) => {
        if (err) {
          console.error('Search error:', err);
          return;
        }

        if (results.length === 0) {
          console.log(`No emails found for ${config.user}`);
          startIdleMode(imap, config.user);
          return;
        }

        console.log(`📧 Found ${results.length} emails for ${config.user}`);
        fetchAndProcessEmails(imap, results, config.user, () => {
          startIdleMode(imap, config.user);
        });
      });
    });
  });

  imap.once('error', (err: Error) => {
    console.error(`❌ IMAP error for ${config.user}:`, err);
  });

  imap.once('end', () => {
    console.log(`Connection ended for ${config.user}, reconnecting...`);
    setTimeout(() => connectAndSync(config), 5000);
  });

  imap.connect();
  imapConnections.set(config.user, imap);
}

function startIdleMode(imap: Imap, account: string) {
  console.log(`🔔 IDLE mode started for ${account}`);

  imap.on('mail', (numNewMsgs: number) => {
    console.log(`📧 ${numNewMsgs} new email(s) received for ${account}`);

    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error('Search error:', err);
        return;
      }

      if (results.length > 0) {
        fetchAndProcessEmails(imap, results, account);
      }
    });
  });
}

function fetchAndProcessEmails(
  imap: Imap,
  messageIds: number[],
  account: string,
  callback?: () => void
) {
  const fetch = imap.fetch(messageIds, {
    bodies: '',
    struct: true
  });

  fetch.on('message', (msg, seqno) => {
    msg.on('body', async (stream) => {
      try {
        const parsed = await simpleParser(stream);

        const email = await Email.create({
          messageId: parsed.messageId || `${account}-${Date.now()}-${seqno}`,
          account,
          folder: 'INBOX',
          from: parsed.from?.text || 'unknown',
          to: parsed.to?.value.map(t => t.address!) || [],
          subject: parsed.subject || '(No Subject)',
          body: parsed.text || '',
          html: parsed.html || '',
          date: parsed.date || new Date(),
          isRead: false,
          isFlagged: false,
          attachments: parsed.attachments?.map(a => ({
            filename: a.filename || 'unknown',
            size: a.size || 0
          })) || []
        });

        // Index in Elasticsearch
        await indexEmail(email);

        // AI Categorization
        const category = await categorizeEmail(email);
        email.category = category;
        await email.save();

        // Send Slack notification if Interested
        if (category === 'Interested') {
          await sendSlackNotification(email);
          await triggerWebhook(email);
        }

        // Emit real-time update
        io.emit('new-email', email);

        console.log(`✅ Processed: ${email.subject.substring(0, 50)}`);
      } catch (error) {
        console.error('Error processing email:', error);
      }
    });
  });

  fetch.once('error', (err: Error) => {
    console.error('Fetch error:', err);
  });

  fetch.once('end', () => {
    if (callback) callback();
  });
}