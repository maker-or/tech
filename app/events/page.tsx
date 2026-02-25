"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Radio, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CrashEvent = {
  event_id: string;
  vehicles: string[];
  timestamp: string;
  lat: number;
  lng: number;
  received_at?: string;
};

function eventKey(event: CrashEvent) {
  return `${event.event_id}-${event.timestamp}-${event.lat}-${event.lng}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function EventsPage() {
  const [events, setEvents] = useState<CrashEvent[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "closed">(
    "connecting",
  );
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const loadSnapshot = async () => {
    const response = await fetch("/api/data/v1", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      events?: CrashEvent[];
    };
    if (!Array.isArray(payload.events)) return;
    setEvents(payload.events);
    setLastUpdate(new Date().toISOString());
  };

  useEffect(() => {
    void loadSnapshot();

    const source = new EventSource("/api/data/v1/stream");

    source.onopen = () => {
      setStatus("live");
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as CrashEvent;
        setEvents((current) => {
          const exists = current.some((item) => eventKey(item) === eventKey(event));
          if (exists) return current;
          return [event, ...current].slice(0, 300);
        });
        setLastUpdate(new Date().toISOString());
      } catch {
        // Ignore malformed stream message.
      }
    };

    source.onerror = () => {
      setStatus("closed");
    };

    return () => {
      setStatus("closed");
      source.close();
    };
  }, []);

  const latest = useMemo(() => events[0] ?? null, [events]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4" />
                  Event Stream Monitor
                </CardTitle>
                <CardDescription>
                  Live feed for POST payloads received on
                  {" "}
                  <code>/api/data/v1</code>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={status === "live" ? "secondary" : "outline"}>
                  <Radio className="mr-1 size-3" />
                  {status}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => void loadSnapshot()}>
                  <RefreshCw className="mr-1 size-3.5" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {lastUpdate ? `Last update: ${formatDate(lastUpdate)}` : "Waiting for data..."}
          </CardContent>
        </Card>

        {latest ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Latest Event</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <span className="text-muted-foreground">event_id:</span> {latest.event_id}
              </div>
              <div>
                <span className="text-muted-foreground">timestamp:</span> {formatDate(latest.timestamp)}
              </div>
              <div>
                <span className="text-muted-foreground">coordinates:</span> {latest.lat}, {latest.lng}
              </div>
              <div>
                <span className="text-muted-foreground">vehicles:</span> {latest.vehicles.join(", ")}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Incoming Events ({events.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No events yet. POST to <code>/api/data/v1</code> and they will appear here.
              </div>
            ) : (
              events.map((event) => (
                <div key={eventKey(event)} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{event.event_id}</p>
                    <Badge variant="outline">{formatDate(event.timestamp)}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Vehicles: {event.vehicles.join(", ")}
                  </p>
                  <p className="text-muted-foreground">
                    Location: {event.lat}, {event.lng}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
