import { v } from "convex/values";
import { query } from "./_generated/server";

function toMillis(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function inTimeRange(
  timestamp: string,
  startTime?: string,
  endTime?: string,
) {
  const point = toMillis(timestamp);
  if (point === null) {
    return false;
  }

  const start = startTime ? toMillis(startTime) : null;
  const end = endTime ? toMillis(endTime) : null;

  if (start !== null && point < start) return false;
  if (end !== null && point > end) return false;
  return true;
}

function includesIgnoreCase(values: string[], term?: string) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
}

function buildLocationKey(parts: string[]) {
  if (parts.length === 0) return "unknown";
  return parts.join(" | ");
}

export const searchCrashes = query({
  args: {
    location: v.optional(v.string()),
    vehicleId: v.optional(v.string()),
    date: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));

    return rows
      .filter((row) => {
        const locationOk = includesIgnoreCase(row.location, args.location);
        const vehicleOk = includesIgnoreCase(row.vehicleId, args.vehicleId);
        const dateOk = !args.date || row.timeStamp.includes(args.date);
        const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);

        return locationOk && vehicleOk && dateOk && periodOk;
      })
      .slice(0, limit)
      .map((row) => ({
        timeStamp: row.timeStamp,
        vehicleId: row.vehicleId,
        location: row.location,
      }));
  },
});

export const getCrashesInPeriod = query({
  args: {
    location: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200));

    const matched = rows
      .filter((row) => {
        const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);
        const locationOk = includesIgnoreCase(row.location, args.location);
        return periodOk && locationOk;
      })
      .slice(0, limit)
      .map((row) => ({
        timeStamp: row.timeStamp,
        vehicleId: row.vehicleId,
        location: row.location,
      }));

    return {
      totalMatched: matched.length,
      startTime: args.startTime,
      endTime: args.endTime,
      locationFilter: args.location ?? null,
      crashes: matched,
    };
  },
});

export const listVehicleIdsInPeriod = query({
  args: {
    location: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const vehicleSet = new Set<string>();

    for (const row of rows) {
      const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);
      const locationOk = includesIgnoreCase(row.location, args.location);
      if (!periodOk || !locationOk) continue;

      for (const vehicle of row.vehicleId) {
        vehicleSet.add(vehicle);
      }
    }

    const limit = Math.max(1, Math.min(args.limit ?? 200, 1000));
    const vehicles = Array.from(vehicleSet).slice(0, limit);

    return {
      totalVehicleIds: vehicleSet.size,
      returnedVehicleIds: vehicles.length,
      startTime: args.startTime,
      endTime: args.endTime,
      locationFilter: args.location ?? null,
      vehicleIds: vehicles,
    };
  },
});

export const findCrashesByVehicle = query({
  args: {
    vehicleId: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const limit = Math.max(1, Math.min(args.limit ?? 100, 250));

    const crashes = rows
      .filter((row) => {
        const vehicleOk = includesIgnoreCase(row.vehicleId, args.vehicleId);
        const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);
        return vehicleOk && periodOk;
      })
      .slice(0, limit)
      .map((row) => ({
        timeStamp: row.timeStamp,
        vehicleId: row.vehicleId,
        location: row.location,
      }));

    return {
      suspectVehicle: args.vehicleId,
      totalMatched: crashes.length,
      crashes,
    };
  },
});

export const getCrashStats = query({
  args: {
    location: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();

    const matched = rows.filter((row) => {
      const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);
      const locationOk = includesIgnoreCase(row.location, args.location);
      return periodOk && locationOk;
    });

    const vehicleSet = new Set<string>();
    let earliest: string | null = null;
    let latest: string | null = null;

    for (const row of matched) {
      for (const vehicle of row.vehicleId) {
        vehicleSet.add(vehicle);
      }

      if (!earliest || row.timeStamp < earliest) earliest = row.timeStamp;
      if (!latest || row.timeStamp > latest) latest = row.timeStamp;
    }

    return {
      locationFilter: args.location ?? null,
      startTime: args.startTime,
      endTime: args.endTime,
      totalCrashes: matched.length,
      uniqueVehicleCount: vehicleSet.size,
      earliestCrashAt: earliest,
      latestCrashAt: latest,
    };
  },
});

export const getHotspotLocations = query({
  args: {
    startTime: v.string(),
    endTime: v.string(),
    topN: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const counts = new Map<string, number>();

    for (const row of rows) {
      const periodOk = inTimeRange(row.timeStamp, args.startTime, args.endTime);
      if (!periodOk) continue;

      const key = buildLocationKey(row.location);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const topN = Math.max(1, Math.min(args.topN ?? 10, 50));
    const hotspots = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([locationKey, crashCount]) => ({
        locationKey,
        crashCount,
      }));

    return {
      startTime: args.startTime,
      endTime: args.endTime,
      hotspots,
    };
  },
});

export const listCrashesForGeoFilter = query({
  args: {
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("crash").collect();
    const limit = Math.max(1, Math.min(args.limit ?? 500, 5000));

    return rows
      .filter((row) => inTimeRange(row.timeStamp, args.startTime, args.endTime))
      .slice(0, limit)
      .map((row) => ({
        timeStamp: row.timeStamp,
        vehicleId: row.vehicleId,
        location: row.location,
      }));
  },
});
