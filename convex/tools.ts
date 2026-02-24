import { createTool } from "@convex-dev/agent"
import { api } from "./_generated/api"
import { z } from "zod"

export const getCrashesByDateTool = createTool({
  description: "Get all crashes for a specific date (YYYY-MM-DD).",
  args: z.object({
    date: z.string(),
  }),
  handler: async (ctx, args) => {
    const crashes = await ctx.runQuery(api.crashQueries.listCrashesByDate, args)
    return { date: args.date, total: crashes.length, crashes }
  },
})

export const getCrashesByDateAndTimeWindowTool = createTool({
  description:
    "Get all crashes for a date in a time window (HH:MM, 24-hour format).",
  args: z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
  }),
  handler: async (ctx, args) => {
    const crashes = await ctx.runQuery(
      api.crashQueries.listCrashesByDateAndTimeWindow,
      args,
    )
    return {
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      total: crashes.length,
      crashes,
    }
  },
})

export const getCrashesByLocationTool = createTool({
  description:
    "Get crashes by location text for a specific date.",
  args: z.object({
    location: z.string(),
    date: z.string(),
  }),
  handler: async (ctx, args) => {
    const crashes = await ctx.runQuery(
      api.crashQueries.listCrashesByLocation,
      args,
    )
    return { ...args, total: crashes.length, crashes }
  },
})

export const getCrashesByVehicleIdTool = createTool({
  description:
    "Get crashes involving a vehicle ID for a specific date.",
  args: z.object({
    vehicleId: z.string(),
    date: z.string(),
  }),
  handler: async (ctx, args) => {
    const crashes = await ctx.runQuery(
      api.crashQueries.listCrashesByVehicleId,
      args,
    )
    return { ...args, total: crashes.length, crashes }
  },
})

export const getCrashSummaryByDateTool = createTool({
  description:
    "Get a summary for a date including total crashes, top locations, and top vehicles.",
  args: z.object({
    date: z.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.runQuery(api.crashQueries.getCrashSummaryByDate, args)
  },
})

export const crashTools = {
  getCrashesByDateTool,
  getCrashesByDateAndTimeWindowTool,
  getCrashesByLocationTool,
  getCrashesByVehicleIdTool,
  getCrashSummaryByDateTool,
}
