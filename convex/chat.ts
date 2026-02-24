import { createThread, listMessages, saveMessage } from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalAction, mutation, query } from "./_generated/server";
import { agent } from "./agent";

export const createChatThread = mutation({
  args: {},
  handler: async (ctx) => {
    return await createThread(ctx, components.agent, {
      title: "Natural language database query",
    });
  },
});

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      prompt,
    });

    await ctx.scheduler.runAfter(0, (internal as any).chat.generateResponse, {
      threadId,
      promptMessageId: messageId,
    });
  },
});

export const generateResponse = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
  },
  handler: async (ctx, { threadId, promptMessageId }) => {
    await (agent as any).generateText(ctx, { threadId }, { promptMessageId });
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await listMessages(ctx, components.agent, args);
  },
});

export const generateTextInAction = action({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, prompt }) => {
    const result = await (agent as any).generateText(
      ctx,
      { threadId },
      { prompt },
    );
    return result.text;
  },
});
