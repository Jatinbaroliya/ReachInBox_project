import { Request, Response } from 'express';
import Email from '../models/Email';
import { isDummyMode } from '../config/runtime';
import { dummyEmails } from '../mock/dummyData';
import { searchEmails } from '../services/elasticsearchService';
import { generateSuggestedReply } from '../services/ragService';
import { categorizeEmail } from '../services/aiCategorizationService';
import { indexEmail } from '../services/elasticsearchService';

export const getEmails = async (req: Request, res: Response) => {
  try {
    const { account, folder, category, limit = 50 } = req.query;

    if (isDummyMode) {
      let items = [...dummyEmails];
      if (account) items = items.filter(e => e.account === account);
      if (folder) items = items.filter(e => e.folder === folder);
      if (category) items = items.filter(e => e.category === category);
      items.sort((a, b) => (+new Date(b.date as any)) - (+new Date(a.date as any)));
      return res.json(items.slice(0, Number(limit)));
    }

    const filter: any = {};
    if (account) filter.account = account;
    if (folder) filter.folder = folder;
    if (category) filter.category = category;

    const emails = await Email.find(filter)
      .sort({ date: -1 })
      .limit(Number(limit));

    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
};

export const searchEmailsController = async (req: Request, res: Response) => {
  try {
    const { q, account, folder, category } = req.query;

    if (isDummyMode) {
      const query = (q as string) || '';
      let items = [...dummyEmails];
      if (account) items = items.filter(e => e.account === account);
      if (folder) items = items.filter(e => e.folder === folder);
      if (category) items = items.filter(e => e.category === category);
      const lower = query.toLowerCase();
      const results = items.filter(e =>
        (e.subject || '').toLowerCase().includes(lower) ||
        (e.body || '').toLowerCase().includes(lower) ||
        (e.from || '').toLowerCase().includes(lower)
      );
      return res.json(results);
    }

    const results = await searchEmails(q as string, {
      account: account as string,
      folder: folder as string,
      category: category as string
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
};

export const getEmailById = async (req: Request, res: Response) => {
  try {
    if (isDummyMode) {
      const found = dummyEmails.find(e => e._id === req.params.id);
      if (!found) return res.status(404).json({ error: 'Email not found' });
      return res.json(found);
    }

    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch email' });
  }
};

export const getSuggestedReply = async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    console.log(`📧 Requested suggested reply for email ID: ${emailId}`);

    if (isDummyMode) {
      const found = dummyEmails.find(e => e._id === emailId);
      if (!found) {
        console.warn(`⚠️ Email not found in dummy mode: ${emailId}`);
        return res.status(404).json({ error: 'Email not found' });
      }
      // Simple canned response in dummy mode
      const reply = `Hi there,\n\nThanks for reaching out! We'd be happy to share more about ReachInbox and how it can help your team automate outreach. You can pick a convenient time here: https://cal.com/reachinbox/meeting\n\nBest regards,\nThe ReachInbox Team`;
      return res.json({ reply });
    }

    const email = await Email.findById(emailId);

    if (!email) {
      console.warn(`⚠️ Email not found in database: ${emailId}`);
      return res.status(404).json({ error: 'Email not found' });
    }

    console.log(`✅ Found email: ${email.subject?.substring(0, 50)}`);
    const reply = await generateSuggestedReply(email);

    res.json({ reply });
  } catch (error) {
    console.error('❌ Error in getSuggestedReply:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    res.status(500).json({ error: 'Failed to generate reply', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const recategorizeEmails = async (req: Request, res: Response) => {
  try {
    if (isDummyMode) {
      return res.json({ message: 'Recategorization not available in dummy mode', categorized: 0 });
    }

    // Find all emails without categories
    const uncategorizedEmails = await Email.find({ 
      $or: [
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    }).limit(100); // Process in batches

    let categorized = 0;
    let failed = 0;

    for (const email of uncategorizedEmails) {
      try {
        console.log(`🤖 Re-categorizing email: ${email.subject?.substring(0, 50)}`);
        const category = await categorizeEmail(email);
        if (category) {
          email.category = category;
          await email.save();
          await indexEmail(email); // Re-index with category
          categorized++;
          console.log(`✅ Re-categorized as: ${category}`);
        } else {
          failed++;
          console.warn(`⚠️ Could not categorize: ${email.subject?.substring(0, 50)}`);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Error categorizing email ${email._id}:`, error);
      }
    }

    res.json({
      message: `Recategorization complete`,
      total: uncategorizedEmails.length,
      categorized,
      failed
    });
  } catch (error) {
    console.error('Recategorization error:', error);
    res.status(500).json({ error: 'Failed to recategorize emails' });
  }
};