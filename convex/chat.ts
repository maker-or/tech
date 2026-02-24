import { action, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { agent } from './agent';
import { internal } from './_generated/api';
import { crashTools } from './tools';

// Internal mutation to add a user message to the thread
export const addUserMessage = internalMutation({
  args: {
    threadId: v.id('threads'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      threadId: args.threadId,
      role: 'user',
      content: args.content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: Date.now() });
  },
});

// Internal mutation to save the final complete response
export const saveResponse = internalMutation({
  args: {
    threadId: v.id('threads'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('messages', {
      threadId: args.threadId,
      role: 'assistant',
      content: args.content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { lastMessageAt: Date.now() });
  },
});

export const sendMessage = action({
  args: {
    threadId: v.id('threads'),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation((internal as any).chat.addUserMessage, {
      threadId: args.threadId,
      content: args.message,
    });

    const response = await (agent as any).generateText(
      ctx,
      { threadId: args.threadId },
      {
        messages: [{ role: 'user', content: args.message }],
        tools: crashTools,
      },
    );

    await ctx.runMutation((internal as any).chat.saveResponse, {
      threadId: args.threadId,
      content: response.text ?? '',
    });

    return null;
  },
});
