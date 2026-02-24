import { Agent } from "@convex-dev/agent";
import { createTool } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { api } from "./_generated/api";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

// The Groq API key is required and should be set in Convex environment variables.
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export const agent = new Agent((components as any).agent, {
  name: "database-query-agent",
  languageModel: groq("openai/gpt-oss-120b"),
  instructions:
    "You are an investigation assistant for police teams. Always call relevant tools before answering factual database questions. Prefer exact time windows and location filters, return concise evidence-focused summaries, and surface vehicle IDs, counts, and hotspots when useful for narrowing suspects.",
  tools: {
    query_crashes: createTool({
      description:
        "General crash search by location, vehicle ID, date, and optional period.",
      args: z.object({
        location: z
          .string()
          .optional()
          .describe("Location keyword like area/street/city."),
        vehicleId: z
          .string()
          .optional()
          .describe("Vehicle identifier or partial plate."),
        date: z
          .string()
          .optional()
          .describe("Date token found in timestamp, for example 2026-02-24."),
        startTime: z
          .string()
          .optional()
          .describe("Start of period in ISO date-time."),
        endTime: z
          .string()
          .optional()
          .describe("End of period in ISO date-time."),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum crashes to return."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery((api as any).crash.searchCrashes, args);
      },
    }),
    get_crashes_in_period: createTool({
      description:
        "Fetch all crashes for a location inside a required time period.",
      args: z.object({
        location: z
          .string()
          .optional()
          .describe("Location keyword to constrain the search."),
        startTime: z
          .string()
          .describe("Start of investigation window, ISO date-time."),
        endTime: z
          .string()
          .describe("End of investigation window, ISO date-time."),
        limit: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum crashes returned."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery((api as any).crash.getCrashesInPeriod, args);
      },
    }),
    list_vehicle_ids_in_period: createTool({
      description:
        "List distinct vehicle IDs involved in crashes during a location/time window.",
      args: z.object({
        location: z
          .string()
          .optional()
          .describe("Location keyword to constrain the search."),
        startTime: z
          .string()
          .describe("Start of investigation window, ISO date-time."),
        endTime: z
          .string()
          .describe("End of investigation window, ISO date-time."),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .optional()
          .describe("Maximum vehicle IDs returned."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery(
          (api as any).crash.listVehicleIdsInPeriod,
          args,
        );
      },
    }),
    find_crashes_by_vehicle: createTool({
      description:
        "Find crashes linked to one suspect vehicle ID, optionally within a period.",
      args: z.object({
        vehicleId: z
          .string()
          .describe("Suspect vehicle identifier or partial plate."),
        startTime: z
          .string()
          .optional()
          .describe("Optional start time in ISO date-time."),
        endTime: z
          .string()
          .optional()
          .describe("Optional end time in ISO date-time."),
        limit: z
          .number()
          .min(1)
          .max(250)
          .optional()
          .describe("Maximum crashes returned."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery(
          (api as any).crash.findCrashesByVehicle,
          args,
        );
      },
    }),
    get_crash_stats: createTool({
      description:
        "Get summary counts for crashes and unique vehicles in a period.",
      args: z.object({
        location: z
          .string()
          .optional()
          .describe("Location keyword to constrain the search."),
        startTime: z.string().describe("Start of period in ISO date-time."),
        endTime: z.string().describe("End of period in ISO date-time."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery((api as any).crash.getCrashStats, args);
      },
    }),
    get_hotspot_locations: createTool({
      description: "Rank top crash hotspot locations for a given period.",
      args: z.object({
        startTime: z.string().describe("Start of period in ISO date-time."),
        endTime: z.string().describe("End of period in ISO date-time."),
        topN: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("How many hotspots to return."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runQuery((api as any).crash.getHotspotLocations, args);
      },
    }),
    find_crashes_by_place_boundary: createTool({
      description:
        "Find crashes that fall inside the resolved administrative boundary of a place name (for example Vijayawada, Guntur, Andhra Pradesh).",
      args: z.object({
        placeName: z.string().describe("Place name to resolve in map service."),
        startTime: z
          .string()
          .optional()
          .describe("Optional start time in ISO date-time."),
        endTime: z
          .string()
          .optional()
          .describe("Optional end time in ISO date-time."),
        limit: z
          .number()
          .min(1)
          .max(5000)
          .optional()
          .describe("Maximum rows to scan/return."),
      }),
      handler: async (ctx, args): Promise<unknown> => {
        return await ctx.runAction(
          (api as any).placeBoundary.findCrashesByPlaceBoundary,
          args,
        );
      },
    }),
  },
  maxSteps: 6,
});
