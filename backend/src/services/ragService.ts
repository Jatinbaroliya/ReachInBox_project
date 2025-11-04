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
  const prompt = `Based on the following context and email, generate a professional reply.

Context:
Product: ${CONTEXT_DATA.product}
Agenda: ${CONTEXT_DATA.agenda}
Meeting booking link: ${CONTEXT_DATA.meetingLink}

Email received:
Subject: ${email.subject}
Body: ${email.body}

Generate a reply that:
1. Acknowledges their interest
2. Provides relevant information based on context
3. Includes the meeting booking link if appropriate
4. Is professional and friendly
5. Is concise (2-3 paragraphs max)`;

  try {
    if (isDummyMode || !process.env.OPENAI_API_KEY) {
      return `Hi ${email.from?.split(' ')[0] || 'there'},\n\nThanks for reaching out! We'd be happy to share more about ReachInbox and how it can help your team automate outreach. You can pick a convenient time here: ${CONTEXT_DATA.meetingLink}\n\nBest regards,\nThe ReachInbox Team`;
    }
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful sales assistant. Generate professional email replies.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    return response.choices[0].message.content || 'Unable to generate reply';
  } catch (error) {
    console.error('RAG generation error:', error);
    return 'Unable to generate reply at this time';
  }
}