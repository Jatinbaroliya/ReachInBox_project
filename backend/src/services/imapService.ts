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
      tls: true,
      // keep rejectUnauthorized false in dev only if you are using local mocks
      tlsOptions: {
        rejectUnauthorized: false // DEV ONLY — accepts self-signed certs
      } as any
    } as any;

    await connectAndSync(config);
  }
}

async function connectAndSync(config: ImapConfig) {
  const imap = new Imap(config as any);

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

// Helper: map common Gmail labels to application categories
function mapGmailLabelsToCategory(labels: string[] | undefined): string | null {
  if (!labels || !labels.length) return null;

  const normalized = labels.map(l => (l || '').toString().toLowerCase());

  // common Gmail automatic categories
  if (normalized.some(l => l.includes('category_promotions') || l.includes('promotions') || l.includes('promos'))) return 'Promotions';
  if (normalized.some(l => l.includes('category_social') || l.includes('social'))) return 'Social';
  if (normalized.some(l => l.includes('category_updates') || l.includes('updates') || l.includes('notifications'))) return 'Updates';
  if (normalized.some(l => l.includes('spam') || l.includes('junk'))) return 'Spam';

  // user/custom labels could directly map to app categories like 'Interested'
  if (normalized.some(l => l.includes('interested'))) return 'Interested';
  if (normalized.some(l => l.includes('important') || l.includes('\\important'))) return 'Important';

  return null;
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
    let gmLabels: any[] | undefined = undefined;

    msg.on('attributes', (attrs: any) => {
      // Gmail exposes labels under 'x-gm-labels'
      const raw = attrs && (attrs['x-gm-labels'] || attrs['X-GM-LABELS']);
      if (raw) {
        if (Array.isArray(raw)) gmLabels = raw.map((r: any) => String(r));
        else gmLabels = [String(raw)];
      }
    });

    msg.on('body', async (stream) => {
      try {
        const parsed: any = await simpleParser(stream as any);

        // determine category from Gmail labels first (if available)
        const labelCategory = mapGmailLabelsToCategory(gmLabels as string[] | undefined);

        const email = await Email.create({
          messageId: parsed.messageId || `${account}-${Date.now()}-${seqno}`,
          account,
          folder: 'INBOX',
          from: parsed.from?.text || 'unknown',
          to: parsed.to?.value?.map((t: any) => t.address) || [],
          subject: parsed.subject || '(No Subject)',
          body: parsed.text || '',
          html: parsed.html || '',
          date: parsed.date || new Date(),
          isRead: false,
          isFlagged: false,
          attachments: parsed.attachments?.map((a: any) => ({
            filename: a.filename || 'unknown',
            size: a.size || 0
          })) || [],
          // set initial category to label-derived if present; otherwise left empty for AI
          category: labelCategory || undefined
        });

        if (gmLabels && gmLabels.length) {
          console.log(`Labels for ${email.messageId}:`, gmLabels);
        }

        // Index in Elasticsearch
        await indexEmail(email);

        // If we didn't get a category from labels, fallback to AI categorization
        if (!email.category) {
          try {
            const category = await categorizeEmail(email);
            email.category = category;
            await email.save();
          } catch (aiErr) {
            console.error('AI categorization failed:', aiErr);
          }
        }

        // Send Slack notification if Interested
        if (email.category === 'Interested') {
          await sendSlackNotification(email);
          await triggerWebhook(email);
        }

        // Emit real-time update
        io.emit('new-email', email);

        console.log(`✅ Processed: ${email.subject.substring(0, 50)} (category: ${email.category || 'Uncategorized'})`);
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