import { v } from "convex/values";
import { api } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

export const getinfo = query({
  args: {
    time: v.number(),
    date: v.string(),
    location: v.string(),
  },
  handler: async (ctx, args) => {},
});
