import { query } from "./_generated/server"
import { v } from "convex/values"

const getDayBounds = (date: string) => {
  const start = `${date}T00:00:00.000Z`
  const end = `${date}T23:59:59.999Z`
  return { start, end }
}

const inTimeWindow = (
  timeStamp: string,
  date: string,
  startTime: string,
  endTime: string,
) => {
  if (!timeStamp.startsWith(`${date}T`)) return false
  const time = timeStamp.slice(11, 16)
  return time >= startTime && time <= endTime
}

export const listCrashesByDate = query({
  args: { date: v.string() }, // YYYY-MM-DD
  handler: async (ctx, { date }) => {
    const { start, end } = getDayBounds(date)
    return await ctx.db
      .query("crash")
      .withIndex("by_timestamp", (q) => q.gte("timeStamp", start).lte("timeStamp", end))
      .collect()
  },
})

export const listCrashesByDateAndTimeWindow = query({
  args: {
    date: v.string(), // YYYY-MM-DD
    startTime: v.string(), // HH:MM
    endTime: v.string(), // HH:MM
  },
  handler: async (ctx, { date, startTime, endTime }) => {
    const startBound = `${date}T${startTime}:00.000Z`
    const endBound = `${date}T${endTime}:59.999Z`
    const rows = await ctx.db
      .query("crash")
      .withIndex("by_timestamp", (q) =>
        q.gte("timeStamp", startBound).lte("timeStamp", endBound),
      )
      .collect()

    // Keep this guard for string-format edge cases.
    return rows.filter((row) => inTimeWindow(row.timeStamp, date, startTime, endTime))
  },
})

export const listCrashesByLocation = query({
  args: {
    location: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, { location, date }) => {
    const normalizedLocation = location.trim().toLowerCase()
    const { start, end } = getDayBounds(date)
    const rows = await ctx.db
      .query("crash")
      .withIndex("by_timestamp", (q) => q.gte("timeStamp", start).lte("timeStamp", end))
      .collect()

    return rows.filter((row) =>
      row.location.some((value) => value.toLowerCase().includes(normalizedLocation)),
    )
  },
})

export const listCrashesByVehicleId = query({
  args: {
    vehicleId: v.string(),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, { vehicleId, date }) => {
    const normalizedVehicleId = vehicleId.trim().toLowerCase()
    const { start, end } = getDayBounds(date)
    const rows = await ctx.db
      .query("crash")
      .withIndex("by_timestamp", (q) => q.gte("timeStamp", start).lte("timeStamp", end))
      .collect()

    return rows.filter((row) =>
      row.vehicleId.some((value) => value.toLowerCase() === normalizedVehicleId),
    )
  },
})

export const getCrashSummaryByDate = query({
  args: { date: v.string() }, // YYYY-MM-DD
  handler: async (ctx, { date }) => {
    const { start, end } = getDayBounds(date)
    const crashes = await ctx.db
      .query("crash")
      .withIndex("by_timestamp", (q) => q.gte("timeStamp", start).lte("timeStamp", end))
      .collect()

    const byLocation = new Map<string, number>()
    const byVehicleId = new Map<string, number>()

    for (const crash of crashes) {
      for (const loc of crash.location) {
        byLocation.set(loc, (byLocation.get(loc) ?? 0) + 1)
      }
      for (const vehicleId of crash.vehicleId) {
        byVehicleId.set(vehicleId, (byVehicleId.get(vehicleId) ?? 0) + 1)
      }
    }

    return {
      date,
      totalCrashes: crashes.length,
      topLocations: [...byLocation.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([location, count]) => ({ location, count })),
      topVehicles: [...byVehicleId.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([vehicleId, count]) => ({ vehicleId, count })),
    }
  },
})
