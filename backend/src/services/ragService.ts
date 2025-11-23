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

const CONTEXT_DATA = {
  product: 'ReachInbox AI Email Platform',
  agenda: 'We help businesses automate cold outreach and lead generation',
  meetingLink: 'https://cal.com/reachinbox/meeting'
};

export async function generateSuggestedReply(email: IEmail): Promise<string> {
  // Extract sender name from email address
  const senderName = email.from?.split('<')[0]?.trim() || email.from?.split('@')[0] || 'there';
  const emailBody = email.body || email.html || '';
  const emailSubject = email.subject || '(No Subject)';

  const prompt = `Based on the following context and email, generate a professional reply.

Context:
Product: ${CONTEXT_DATA.product}
Agenda: ${CONTEXT_DATA.agenda}
Meeting booking link: ${CONTEXT_DATA.meetingLink}

Email received:
From: ${email.from}
Subject: ${emailSubject}
Body: ${emailBody.substring(0, 1000)}

Generate a professional email reply that:
1. Acknowledges their message and shows understanding
2. Provides relevant information about ${CONTEXT_DATA.product} based on their inquiry
3. Includes the meeting booking link (${CONTEXT_DATA.meetingLink}) if they seem interested
4. Is professional, friendly, and concise (2-3 paragraphs max)
5. Addresses any specific questions or concerns they mentioned
6. Uses a natural, conversational tone

Reply:`;

  try {
    console.log(`🤖 Generating suggested reply for email: ${emailSubject.substring(0, 50)}`);
    
    // Only use dummy mode if actually in dummy mode
    if (isDummyMode) {
      console.log('📝 Using dummy mode for reply generation');
      // Generate a more personalized dummy reply
      const personalizedReply = `Hi ${senderName},\n\nThanks for reaching out about ${emailSubject}!\n\nWe'd be happy to share more about ReachInbox and how it can help your team automate outreach and lead generation. Our platform makes it easy to manage email campaigns and track engagement.\n\nYou can pick a convenient time to chat here: ${CONTEXT_DATA.meetingLink}\n\nLooking forward to connecting!\n\nBest regards,\nThe ReachInbox Team`;
      return personalizedReply;
    }

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not set - cannot generate AI reply');
      // Return a basic template instead of throwing error
      return `Hi ${senderName},\n\nThank you for your email regarding "${emailSubject}".\n\nWe appreciate you reaching out and would be happy to discuss how ReachInbox can help your business. Please feel free to schedule a time that works for you: ${CONTEXT_DATA.meetingLink}\n\nBest regards,\nThe ReachInbox Team`;
    }

    // Use configurable model, default to gpt-3.5-turbo (more accessible)
    const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    console.log(`🔗 Calling OpenAI API for reply generation with model: ${model}...`);
    
    const response = await getOpenAI().chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful sales assistant for ReachInbox, an AI email platform. Generate professional, friendly, and concise email replies that help potential customers understand the product and encourage them to book a meeting.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    const reply = response.choices[0]?.message?.content?.trim();
    
    if (!reply) {
      console.warn('⚠️ OpenAI returned empty reply');
      throw new Error('Empty reply from OpenAI');
    }

    console.log(`✅ Successfully generated reply (${reply.length} characters)`);
    return reply;
  } catch (error) {
    console.error('❌ RAG generation error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      
      // Check if it's a model access error
      if (error.message.includes('does not exist') || error.message.includes('access')) {
        console.error('⚠️ Model access error - check your OpenAI API key permissions and model availability');
        console.error('💡 Tip: Try setting OPENAI_MODEL=gpt-3.5-turbo in your .env file');
      }
    }
    
    // Return a fallback reply instead of an error message
    return `Hi ${senderName},\n\nThank you for your email regarding "${emailSubject}".\n\nWe appreciate you reaching out and would be happy to discuss how ReachInbox can help your business. Please feel free to schedule a time that works for you: ${CONTEXT_DATA.meetingLink}\n\nBest regards,\nThe ReachInbox Team`;
  }
}