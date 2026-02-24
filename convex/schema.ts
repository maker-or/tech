import { timeStamp } from "node:console";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  crash: defineTable({
    vehicleId: v.array(v.string()),
    location: v.array(v.string()),
    timeStamp: v.string(),
  }),
});
