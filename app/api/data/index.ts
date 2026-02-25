import { Elysia, t } from "elysia";

type CrashEventPayload = {
  event_id: string;
  vehicles: string[];
  timestamp: string;
  lat: number;
  lng: number;
  received_at: string;
};

const EVENT_BUFFER_LIMIT = 300;
const eventBuffer: CrashEventPayload[] = [];
const streamClients = new Set<ReadableStreamDefaultController<string>>();

function pushEvent(event: CrashEventPayload) {
  eventBuffer.unshift(event);
  if (eventBuffer.length > EVENT_BUFFER_LIMIT) {
    eventBuffer.length = EVENT_BUFFER_LIMIT;
  }

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const controller of [...streamClients]) {
    try {
      controller.enqueue(payload);
    } catch {
      streamClients.delete(controller);
    }
  }
}

function parseTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export const data = new Elysia({ prefix: "/data" })
  .get("/v1", () => ({
    count: eventBuffer.length,
    events: eventBuffer,
  }))
  .get("/v1/stream", () => {
    const stream = new ReadableStream<string>({
      // This stream sends all new POSTed events to connected clients.
      start(controller) {
        streamClients.add(controller);

        controller.enqueue("event: ready\ndata: connected\n\n");
        const initial = eventBuffer
          .slice()
          .reverse()
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join("");
        if (initial.length > 0) {
          controller.enqueue(initial);
        }
      },
      cancel() {
        // Best-effort cleanup for disconnected clients.
        // In this runtime cancel doesn't provide the specific controller.
        // Remove closed clients lazily on next broadcast if enqueue fails.
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  })
  .post(
    "/v1",
    ({ body, set }) => {
      const normalizedTime = parseTimestamp(body.timestamp);
      if (!normalizedTime) {
        set.status = 400;
        return {
          error: "timestamp must be a valid ISO date-time string",
        };
      }

      const event: CrashEventPayload = {
        event_id: body.event_id,
        vehicles: body.vehicles,
        timestamp: normalizedTime,
        lat: body.lat,
        lng: body.lng,
        received_at: new Date().toISOString(),
      };

      pushEvent(event);

      return {
        ok: true,
        event,
      };
    },
    {
      body: t.Object({
        event_id: t.String(),
        vehicles: t.Array(t.String()),
        timestamp: t.String(),
        lat: t.Numeric(),
        lng: t.Numeric(),
      }),
    },
  );
