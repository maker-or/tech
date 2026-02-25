# Crash Investigation + AutoRoute Platform

Production-style Next.js + Convex app with two major capabilities:

1. **AI-powered crash investigation chat** backed by Convex Agent tools.
2. **Interactive route planning UI** that supports accident-point detours via map click.

The app is designed for police/investigation workflows where users query crash events by location, vehicle, date windows, and geospatial boundaries.

## What This Project Does

- Stores crash events in Convex (`crash` table).
- Exposes structured query functions for filtering, stats, hotspots, and vehicle lookups.
- Runs an AI agent (Groq model) with explicit tools that call Convex query/action functions.
- Supports place-boundary geofencing (example: *Vijayawada*, *Guntur*, *Andhra Pradesh*) using Nominatim + point-in-polygon checks.
- Provides a route UI using **Leaflet + OpenStreetMap + OSRM**.
- Lets user click anywhere on map, confirm accident point, and apply detour logic.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **UI primitives**: shadcn/base-ui based components
- **Backend/data**: Convex
- **Agent framework**: `@convex-dev/agent`
- **Model provider**: Groq via `@ai-sdk/groq`
- **Mapping/routing (free alternatives)**:
  - Leaflet (map rendering)
  - OpenStreetMap tiles
  - Nominatim (geocoding/place boundaries)
  - OSRM public API (routing)

## Key Features

### 1) Investigation Chat (`/chat`)

Natural-language interface for crash database questions.

Agent tools include:

- `query_crashes`
- `get_crashes_in_period`
- `list_vehicle_ids_in_period`
- `find_crashes_by_vehicle`
- `get_crash_stats`
- `get_hotspot_locations`
- `find_crashes_by_place_boundary`

Tool wiring is in:
- `convex/agent.ts`

Thread/message management is in:
- `convex/chat.ts`
- `components/chat-interface.tsx`

### 2) AutoRoute UI (`/`)

Route planning UI with map click accident confirmation flow.

- User enters onboarding and drop-off points.
- OSRM returns primary + alternative routes.
- User clicks any map coordinate.
- Confirmation dialog appears.
- On confirm, app attempts detour:
  - prefer safest alternative route away from accident point
  - fallback to bypass waypoints around clicked point

Main implementation:
- `components/autoroute.tsx`

## Data Model

Defined in `convex/schema.ts`:

```ts
crash: defineTable({
  vehicleId: v.array(v.string()),
  location: v.array(v.string()),
  timeStamp: v.string(),
})
  .index('by_timestamp', ['timeStamp'])
  .index('by_vehicleId', ['vehicleId'])
  .index('by_location', ['location'])
```

### Schema assumptions

- `timeStamp` is expected to be parseable by `Date.parse()` for time-range filters.
- `location` is an array of strings. Filters currently support:
  - case-insensitive text matching
  - optional coordinate extraction patterns for geofence checks (lat/lon parsed from strings)

## Geospatial Place-Boundary Tool

`find_crashes_by_place_boundary` (in `convex/placeBoundary.ts`) performs:

1. Resolve place via Nominatim search.
2. Prefer polygon/multipolygon boundary if available.
3. Fallback to bbox polygon if boundary unavailable.
4. Parse crash coordinates from `location` text.
5. Run point-in-polygon test.
6. Return:
   - `crashesInsideBoundary`
   - `textMatchedRows` (fallback matches when coordinates missing)
   - scan/match diagnostics

This tool is exposed to agent in `convex/agent.ts` and callable by chat prompts.

## Project Structure

- `app/page.tsx`: default page rendering `AutoRoute`
- `app/chat/page.tsx`: chat page rendering `ChatInterface`
- `components/autoroute.tsx`: map/routing/detour UI
- `components/chat-interface.tsx`: thread-based chat UI
- `convex/schema.ts`: database schema
- `convex/crash.ts`: crash query functions
- `convex/placeBoundary.ts`: place geofence action
- `convex/agent.ts`: agent definition + tool registry
- `convex/chat.ts`: thread creation, send message, async generation

## Local Setup

### Prerequisites

- Node.js 18+
- Bun (recommended in this repo) or npm/pnpm/yarn
- Convex account/project configured

### Install

```bash
bun install
```

### Environment variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_CONVEX_URL=<your_convex_deployment_url>
```

Set Convex environment variable for model access:

```bash
GROQ_API_KEY=<your_groq_api_key>
```

> `GROQ_API_KEY` is read in `convex/agent.ts`.

### Run Convex

```bash
npx convex dev
```

Use this whenever you add/update Convex functions so generated API/types stay in sync.

### Run app

```bash
bun run dev
```

Open:
- `http://localhost:3000` for AutoRoute
- `http://localhost:3000/chat` for Investigation Chat

## Build / Typecheck

```bash
bunx tsc --noEmit
bun run build
```

### Note about restricted networks

This project currently uses `next/font/google` in `app/layout.tsx`. In restricted/offline environments, build can fail when font CSS cannot be fetched.

## How to Use

### Chat flow

Example prompts:

- "Show crashes in Vijayawada from 2026-02-20 to 2026-02-24"
- "List unique vehicles in Guntur between 9AM and 6PM today"
- "Find crashes by vehicle AP09XX1234"
- "Check events inside Andhra Pradesh boundary"

### AutoRoute flow

1. Enter onboarding and drop-off points.
2. Click **Start**.
3. Click any location on map where accident occurred.
4. Confirm in dialog.
5. App reroutes around confirmed accident point.

## Known Limitations

- Public Nominatim and OSRM endpoints are rate-limited; heavy traffic should use self-hosted or paid infrastructure.
- Geofence matching quality depends on whether crash records include parseable coordinates in `location`.
- `findCrashesByPlaceBoundary` currently uses `any` in Convex action typing to avoid generated type circularity.
- Chat thread id is persisted in browser local storage under `db-query-thread-id`.

## Extension Notes

- Add new investigation tools by extending `tools` in `convex/agent.ts`.
- Add richer crash schema fields (severity, exact lat/lon columns, source, officer notes) in `convex/schema.ts` and update `convex/crash.ts` filters.
- For production mapping:
  - host your own tiles/routing/geocoding
  - add request throttling + caching
  - add robust reverse geocoding and snapping

## Scripts

```bash
bun run dev
bun run build
bun run start
bun run lint
```

## License

Internal project. Add your organization license if needed.
