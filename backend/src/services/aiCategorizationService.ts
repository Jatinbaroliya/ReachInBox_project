import OpenAI from 'openai';
import { IEmail } from '../models/Email';
import { isDummyMode } from '../config/runtime';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function categorizeEmail(email: IEmail): Promise<IEmail['category']> {
  const prompt = `Analyze this email and categorize it into ONE of these categories:
1. Interested - Customer wants to buy, learn more, or shows positive interest
2. Meeting Booked - Someone scheduled or confirmed a meeting/call
3. Not Interested - Customer declined or shows no interest
4. Spam - Junk, promotional, or irrelevant emails
5. Out of Office - Automatic away/vacation replies

Email:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.body.substring(0, 500)}

Reply with ONLY the category name. If unsure, choose the closest match.`;

  try {
    if (isDummyMode || !process.env.OPENAI_API_KEY) {
      // naive heuristic for demo mode
      const text = `${email.subject} ${email.body}`.toLowerCase();
      if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
      if (text.includes('interested') || text.includes('learn more')) return 'Interested';
      if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
      if (text.includes('unsubscribe') || text.includes('not interested')) return 'Not Interested';
      return undefined;
    }
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an email classification expert. Respond with only the category name.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 20
    });

    const category = response.choices[0].message.content?.trim();

    const validCategories: IEmail['category'][] = [
      'Interested',
      'Meeting Booked',
      'Not Interested',
      'Spam',
      'Out of Office'
    ];

    if (validCategories.includes(category as IEmail['category'])) {
      return category as IEmail['category'];
    }

    return undefined;
  } catch (error) {
    console.error('AI categorization error:', error);
    return undefined;
  }
}