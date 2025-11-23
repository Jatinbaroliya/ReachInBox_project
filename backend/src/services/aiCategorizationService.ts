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
  // Ensure we have content to analyze
  const emailBody = email.body || email.html || '';
  const emailSubject = email.subject || '';
  const emailFrom = email.from || '';

  const prompt = `Analyze this email and categorize it into ONE of these categories:
1. Interested - Customer wants to buy, learn more, or shows positive interest
2. Meeting Booked - Someone scheduled or confirmed a meeting/call
3. Not Interested - Customer declined or shows no interest
4. Spam - Junk, promotional, or irrelevant emails
5. Out of Office - Automatic away/vacation replies

Email:
Subject: ${emailSubject}
From: ${emailFrom}
Body: ${emailBody.substring(0, 500)}

Reply with ONLY the category name. If unsure, choose the closest match.`;

  try {
    // Only use dummy mode heuristics if actually in dummy mode
    if (isDummyMode) {
      console.log('📝 Using dummy mode heuristics for categorization');
      // Enhanced heuristic for demo mode
      const text = `${emailSubject} ${emailBody}`.toLowerCase();
      
      // Check for Out of Office first (most specific)
      if (text.includes('out of office') || text.includes('ooo') || text.includes('auto-reply') || text.includes('automatic reply')) {
        return 'Out of Office';
      }
      
      // Check for Meeting Booked
      if (text.includes('meeting') || text.includes('schedule') || text.includes('calendar') || text.includes('appointment')) {
        return 'Meeting Booked';
      }
      
      // Check for Interested
      if (text.includes('interested') || text.includes('learn more') || text.includes('pricing') || text.includes('quote') || text.includes('demo')) {
        return 'Interested';
      }
      
      // Check for Not Interested
      if (text.includes('not interested') || text.includes('decline') || text.includes('unsubscribe')) {
        return 'Not Interested';
      }
      
      // Check for Spam indicators (more comprehensive)
      if (text.includes('unsubscribe') || text.includes('promotion') || text.includes('promo') || 
          text.includes('discount') || text.includes('limited time') || text.includes('free cash') ||
          text.includes('free') && (text.includes('money') || text.includes('cash') || text.includes('prize')) ||
          text.includes('click here') || text.includes('act now') || text.includes('limited offer')) {
        return 'Spam';
      }
      
      // Default to Spam if it looks promotional but doesn't match other categories
      if (text.includes('free') || text.includes('offer') || text.includes('deal') || text.includes('sale')) {
        return 'Spam';
      }
      
      console.warn(`⚠️ Dummy mode: No category matched for email. Subject: "${emailSubject.substring(0, 50)}"`);
      return undefined;
    }

    // Use OpenAI API (only if not in dummy mode)
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not set - cannot use AI categorization');
      // Fallback to heuristics if no API key
      console.log('📝 Falling back to heuristics');
      const text = `${emailSubject} ${emailBody}`.toLowerCase();
      if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
      if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
      if (text.includes('interested') || text.includes('learn more')) return 'Interested';
      if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) return 'Spam';
      return undefined;
    }

    // Use configurable model, default to gpt-3.5-turbo (more accessible)
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    // Validate model name - check for common invalid models
    const validModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini'];
    if (!validModels.includes(model.toLowerCase())) {
      console.error(`❌ Invalid model "${model}". Valid models are: ${validModels.join(', ')}. Falling back to heuristics.`);
      // Fall back to heuristics instead of throwing
      const text = `${emailSubject} ${emailBody}`.toLowerCase();
      if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
      if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
      if (text.includes('interested') || text.includes('learn more')) return 'Interested';
      if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) return 'Spam';
      return undefined;
    }
    
    console.log(`🔗 Calling OpenAI API for categorization with model: ${model}...`);
    
    const response = await getOpenAI().chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an email classification expert. Respond with ONLY the category name from the list: Interested, Meeting Booked, Not Interested, Spam, Out of Office.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 20
    });

    const category = response.choices[0]?.message?.content?.trim();

    if (!category) {
      console.warn('⚠️ OpenAI returned empty category');
      return undefined;
    }

    const validCategories: IEmail['category'][] = [
      'Interested',
      'Meeting Booked',
      'Not Interested',
      'Spam',
      'Out of Office'
    ];

    // Try to match category (case-insensitive)
    const matchedCategory = validCategories.find(
      cat => cat.toLowerCase() === category.toLowerCase()
    );

    if (matchedCategory) {
      return matchedCategory;
    }

    // Log if category doesn't match
    console.warn(`⚠️ OpenAI returned invalid category: "${category}". Valid categories are: ${validCategories.join(', ')}`);
    return undefined;
  } catch (error: any) {
    console.error('❌ AI categorization error:', error);
    
    // Handle specific OpenAI API errors - for categorization, we fall back to heuristics
    if (error?.status === 429 || error?.code === 'insufficient_quota' || error?.error?.type === 'insufficient_quota') {
      console.error('⚠️ OpenAI API quota exceeded - falling back to heuristics');
      const text = `${emailSubject} ${emailBody}`.toLowerCase();
      if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
      if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
      if (text.includes('interested') || text.includes('learn more')) return 'Interested';
      if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) return 'Spam';
      return undefined;
    }
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      
      // Check if it's a model access error
      if (error.message.includes('does not exist') || error.message.includes('access') || error?.status === 404) {
        console.error('⚠️ Model access error - falling back to heuristics');
        const text = `${emailSubject} ${emailBody}`.toLowerCase();
        if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
        if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
        if (text.includes('interested') || text.includes('learn more')) return 'Interested';
        if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) return 'Spam';
        return undefined;
      }
    }
    
    // For other errors, fall back to heuristics
    console.warn('⚠️ Falling back to heuristics due to error');
    const text = `${emailSubject} ${emailBody}`.toLowerCase();
    if (text.includes('out of office') || text.includes('ooo')) return 'Out of Office';
    if (text.includes('meeting') || text.includes('schedule')) return 'Meeting Booked';
    if (text.includes('interested') || text.includes('learn more')) return 'Interested';
    if (text.includes('spam') || text.includes('unsubscribe') || text.includes('promo')) return 'Spam';
    return undefined;
  }
}