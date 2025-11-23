import Imap from 'imap';
import { simpleParser } from 'mailparser';
import Email, { IEmail } from '../models/Email';
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
function mapGmailLabelsToCategory(labels: string[] | undefined): 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office' | null {
  if (!labels || !labels.length) return null;

  const normalized = labels.map(l => (l || '').toString().toLowerCase());

  // Map to valid categories only
  if (normalized.some(l => l.includes('spam') || l.includes('junk'))) return 'Spam';
  
  // user/custom labels could directly map to app categories
  if (normalized.some(l => l.includes('interested'))) return 'Interested';
  
  // Note: Gmail categories like Promotions, Social, Updates don't directly map to our categories
  // They will be handled by AI categorization instead
  
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

        const messageId = parsed.messageId || `${account}-${Date.now()}-${seqno}`;
        
        // Check if email already exists
        let email = await Email.findOne({ messageId });
        
        if (email) {
          // Email exists - update fields but preserve category if it already has one
          email.account = account;
          email.folder = 'INBOX';
          email.from = parsed.from?.text || 'unknown';
          email.to = parsed.to?.value?.map((t: any) => t.address) || [];
          email.subject = parsed.subject || '(No Subject)';
          email.body = parsed.text || '';
          email.html = parsed.html || '';
          email.date = parsed.date || new Date();
          email.attachments = parsed.attachments?.map((a: any) => ({
            filename: a.filename || 'unknown',
            size: a.size || 0
          })) || [];
          // Only set category from labels if email doesn't have one yet
          if (!email.category && labelCategory) {
            email.category = labelCategory as 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
          }
          await email.save();
        } else {
          // Email doesn't exist - create new one
          email = await Email.create({
            messageId,
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
        }

        if (gmLabels && gmLabels.length) {
          console.log(`Labels for ${email.messageId}:`, gmLabels);
        }

        // If we didn't get a category from labels, fallback to AI categorization
        // Also check if email was just created (no category) or needs re-categorization
        const hasCategory = email.category && email.category.trim() !== '';
        console.log(`🔍 Checking category for email: ${email.subject.substring(0, 50)}, current category: ${email.category || 'none'}, hasCategory: ${hasCategory}`);
        
        if (!hasCategory) {
          try {
            console.log(`🤖 Attempting AI categorization for email: ${email.subject.substring(0, 50)}`);
            const category = await categorizeEmail(email);
            console.log(`📊 Categorization result: ${category || 'undefined'}`);
            if (category) {
              email.category = category;
              await email.save();
              // Reload email to ensure we have the latest data
              const reloadedEmail = await Email.findById(email._id);
              if (reloadedEmail) {
                email = reloadedEmail;
              }
              console.log(`✅ Email categorized as: ${category}`);
            } else {
              console.warn(`⚠️ AI categorization returned no category for: ${email.subject.substring(0, 50)}`);
              // Try fallback heuristics if AI didn't return a category
              const subjectLower = (email.subject || '').toLowerCase();
              const bodyLower = (email.body || '').toLowerCase();
              const text = `${subjectLower} ${bodyLower}`;
              
              let fallbackCategory: string | undefined = undefined;
              
              // Use heuristics as fallback
              if (text.includes('out of office') || text.includes('ooo') || text.includes('auto-reply')) {
                fallbackCategory = 'Out of Office';
              } else if (text.includes('meeting') || text.includes('schedule') || text.includes('calendar')) {
                fallbackCategory = 'Meeting Booked';
              } else if (text.includes('interested') || text.includes('learn more') || text.includes('pricing')) {
                fallbackCategory = 'Interested';
              } else if (text.includes('not interested') || text.includes('decline')) {
                fallbackCategory = 'Not Interested';
              } else if (text.includes('free') || text.includes('cash') || text.includes('promo') || 
                         text.includes('discount') || text.includes('offer') || text.includes('deal') ||
                         text.includes('unsubscribe')) {
                fallbackCategory = 'Spam';
              }
              
              if (fallbackCategory) {
                email.category = fallbackCategory as 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
                await email.save();
                const reloadedEmail = await Email.findById(email._id);
                if (reloadedEmail) {
                  email = reloadedEmail;
                }
                console.log(`📧 Used fallback heuristics to categorize as: ${fallbackCategory}`);
              } else {
                console.warn(`⚠️ Could not categorize email even with fallback heuristics`);
              }
            }
          } catch (aiErr) {
            console.error('❌ AI categorization failed:', aiErr);
            console.error('Error stack:', aiErr instanceof Error ? aiErr.stack : 'No stack trace');
            
            // Try fallback heuristics even if AI failed
            try {
              const subjectLower = (email.subject || '').toLowerCase();
              const bodyLower = (email.body || '').toLowerCase();
              const text = `${subjectLower} ${bodyLower}`;
              
              let fallbackCategory: string | undefined = undefined;
              
              if (text.includes('out of office') || text.includes('ooo')) {
                fallbackCategory = 'Out of Office';
              } else if (text.includes('meeting') || text.includes('schedule')) {
                fallbackCategory = 'Meeting Booked';
              } else if (text.includes('interested') || text.includes('learn more')) {
                fallbackCategory = 'Interested';
              } else if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) {
                fallbackCategory = 'Spam';
              }
              
              if (fallbackCategory) {
                email.category = fallbackCategory as 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
                await email.save();
                const reloadedEmail = await Email.findById(email._id);
                if (reloadedEmail) {
                  email = reloadedEmail;
                }
                console.log(`📧 Used fallback heuristics after AI error to categorize as: ${fallbackCategory}`);
              }
            } catch (fallbackErr) {
              console.error('❌ Fallback categorization also failed:', fallbackErr);
            }
          }
        } else {
          console.log(`📋 Email categorized from labels as: ${email.category}`);
        }

        // Index in Elasticsearch after categorization (so category is included)
        if (email) {
          await indexEmail(email);

          // Send Slack notification if Interested
          if (email.category === 'Interested') {
            await sendSlackNotification(email);
            await triggerWebhook(email);
          }

          // Emit real-time update
          io.emit('new-email', email);

          console.log(`✅ Processed: ${email.subject.substring(0, 50)} (category: ${email.category || 'Uncategorized'})`);
        }
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