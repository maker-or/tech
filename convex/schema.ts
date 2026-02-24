import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  crash: defineTable({
    vehicleId: v.array(v.string()),
    location: v.array(v.string()),
    timeStamp: v.string(),
  })
    .index('by_timestamp', ['timeStamp'])
    .index('by_vehicleId', ['vehicleId'])
    .index('by_location', ['location']),
});
