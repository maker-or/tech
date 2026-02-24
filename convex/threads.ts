import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { agent } from './agent';

// Create a new conversation thread
export const createThread = mutation({
  args: {
    userId: v.string(), // Using external user identifier
    title: v.optional(v.string()),
  },
  returns: v.id('threads'),
  handler: async (ctx, args) => {
    const { threadId } = await (agent as any).createThread(ctx, {
      userId: args.userId,
      title: args.title ?? 'New Chat',
    });
    return threadId as any;
  },
});

// List user's threads
export const listThreads = query({
  args: { userId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id('threads'),
      title: v.string(),
      lastMessageAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('threads')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

// Get thread messages
export const getMessages = query({
  args: { threadId: v.id('threads') },
  returns: v.array(
    v.object({
      role: v.string(),
      content: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('messages')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .order('asc')
      .collect();
  },
});
