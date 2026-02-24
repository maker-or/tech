import { Agent } from '@convex-dev/agent';
import { components } from './_generated/api';
import { createGroq } from '@ai-sdk/groq';

// The Groq API key is required and should be set in Convex environment variables.
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const agent = new Agent((components as any).agent, {
  name: 'chat',
  languageModel: groq('openai/gpt-oss-120b'),
});
