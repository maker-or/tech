"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type EventLevel = "info" | "warning" | "critical";

type StreamEvent = {
  id: string;
  level: EventLevel;
  status: string;
  message: string;
  location: string;
  latitude: number;
  longitude: number;
  vehicleIds: [string, string];
  timestamp: string;
};

type PositionedVehicle = {
  x: number;
  y: number;
  angle: number;
};

const VEHICLES: [string, string] = ["VH-1024", "VH-7842"];
const CAR_A_INITIAL: PositionedVehicle = { x: 86, y: 82, angle: 0 };
const CAR_B_INITIAL: PositionedVehicle = { x: 612, y: 368, angle: 180 };

const PATH_A = "M 86 82 L 182 82 L 182 148 L 286 148 L 286 224 L 352 224";
const PATH_B = "M 612 368 L 508 368 L 508 302 L 430 302 L 430 224 L 352 224";
const COLLISION_POINT = { x: 352, y: 224 };

const streamLabels: Record<
  EventLevel,
  { badge: "secondary" | "destructive" | "outline"; text: string }
> = {
  info: { badge: "outline", text: "Info" },
  warning: { badge: "secondary", text: "Warning" },
  critical: { badge: "destructive", text: "Critical" },
};

function formatDateTime(timestamp: string) {
  const date = new Date(timestamp);
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
  };
}

function getVehicleOnPath(
  path: SVGPathElement | null,
  progress: number,
): PositionedVehicle {
  if (!path) {
    return { x: 0, y: 0, angle: 0 };
  }

  const length = path.getTotalLength();
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const distance = clampedProgress * length;
  const nextDistance = Math.min(length, distance + 1);

  const point = path.getPointAtLength(distance);
  const next = path.getPointAtLength(nextDistance);

  const angle =
    (Math.atan2(next.y - point.y, next.x - point.x) * 180) / Math.PI;

  return {
    x: point.x,
    y: point.y,
    angle,
  };
}

export function AccidentSimulation() {
  const [progress, setProgress] = React.useState(0);
  const [isRunning, setIsRunning] = React.useState(false);
  const [collisionPulse, setCollisionPulse] = React.useState(false);
  const [events, setEvents] = React.useState<StreamEvent[]>([]);
  const [carA, setCarA] = React.useState<PositionedVehicle>(CAR_A_INITIAL);
  const [carB, setCarB] = React.useState<PositionedVehicle>(CAR_B_INITIAL);

  const pathARef = React.useRef<SVGPathElement>(null);
  const pathBRef = React.useRef<SVGPathElement>(null);

  const resetSimulation = React.useCallback(() => {
    setProgress(0);
    setCollisionPulse(false);
    setEvents([]);
  }, []);

  const pushEvent = React.useCallback((event: Omit<StreamEvent, "id">) => {
    setEvents((prev) => [{ ...event, id: crypto.randomUUID() }, ...prev]);
  }, []);

  const triggerAccident = React.useCallback(() => {
    if (isRunning) {
      return;
    }

    resetSimulation();
    setIsRunning(true);

    pushEvent({
      level: "info",
      status: "Simulation started",
      message: "Both vehicles are moving toward the same intersection.",
      location: "Downtown Node 17",
      latitude: 37.7749,
      longitude: -122.4194,
      vehicleIds: VEHICLES,
      timestamp: new Date().toISOString(),
    });

    window.setTimeout(() => {
      pushEvent({
        level: "warning",
        status: "Impact detected",
        message: "Vehicle proximity reached zero at intersection.",
        location: "Downtown Node 17",
        latitude: 37.7749,
        longitude: -122.4194,
        vehicleIds: VEHICLES,
        timestamp: new Date().toISOString(),
      });
      setCollisionPulse(true);
    }, 2000);

    window.setTimeout(() => {
      pushEvent({
        level: "critical",
        status: "Accident logged",
        message: "Incident persisted to stream for downstream systems.",
        location: "Downtown Node 17",
        latitude: 37.7749,
        longitude: -122.4194,
        vehicleIds: VEHICLES,
        timestamp: new Date().toISOString(),
      });
      setIsRunning(false);
    }, 2600);
  }, [isRunning, pushEvent, resetSimulation]);

  React.useEffect(() => {
    if (!isRunning) {
      return;
    }

    const startedAt = performance.now();
    let rafId = 0;
    const duration = 2000;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const next = Math.min(1, elapsed / duration);
      setProgress(next);

      if (next < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isRunning]);

  React.useEffect(() => {
    if (!collisionPulse) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCollisionPulse(false);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [collisionPulse]);

  React.useEffect(() => {
    setCarA(getVehicleOnPath(pathARef.current, progress));
    setCarB(getVehicleOnPath(pathBRef.current, progress));
  }, [progress]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[3fr_2fr]">
        <Card className="relative h-[78vh] min-h-[520px] w-full">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>City Collision Simulation</CardTitle>
                <CardDescription>
                  Custom SVG map with path-following vehicle impact.
                </CardDescription>
              </div>
              <Button
                onClick={triggerAccident}
                disabled={isRunning}
                variant="secondary"
              >
                {isRunning ? "Running..." : "Accident"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-full pb-4">
            <svg
              viewBox="0 0 700 460"
              className="h-full w-full rounded-lg"
              role="img"
              aria-label="Custom SVG traffic map"
            >
              <defs>
                <linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0f1117" />
                  <stop offset="100%" stopColor="#141720" />
                </linearGradient>
                <linearGradient id="roadGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e2130" />
                  <stop offset="100%" stopColor="#181b27" />
                </linearGradient>
                <filter
                  id="softGlow"
                  x="-30%"
                  y="-30%"
                  width="160%"
                  height="160%"
                >
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="routeGlow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="buildingGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Base */}
              <rect
                x="0"
                y="0"
                width="700"
                height="460"
                fill="url(#mapBg)"
                rx="10"
              />

              {/* Road network — wide arteries */}
              <g
                fill="none"
                stroke="#1e2436"
                strokeWidth="30"
                strokeLinecap="butt"
              >
                <path d="M0 82H700" />
                <path d="M0 224H700" />
                <path d="M0 366H700" />
                <path d="M86 0V460" />
                <path d="M182 0V460" />
                <path d="M286 0V460" />
                <path d="M430 0V460" />
                <path d="M508 0V460" />
                <path d="M612 0V460" />
              </g>

              {/* Road surface — lighter inner strip */}
              <g
                fill="none"
                stroke="#252a3d"
                strokeWidth="18"
                strokeLinecap="butt"
              >
                <path d="M0 82H700" />
                <path d="M0 224H700" />
                <path d="M0 366H700" />
                <path d="M86 0V460" />
                <path d="M182 0V460" />
                <path d="M286 0V460" />
                <path d="M430 0V460" />
                <path d="M508 0V460" />
                <path d="M612 0V460" />
              </g>

              {/* Lane dashes */}
              <g
                fill="none"
                stroke="#3a3f52"
                strokeWidth="1.5"
                strokeDasharray="12 14"
                opacity="0.6"
              >
                <path d="M0 82H700" />
                <path d="M0 224H700" />
                <path d="M0 366H700" />
                <path d="M86 0V460" />
                <path d="M182 0V460" />
                <path d="M286 0V460" />
                <path d="M430 0V460" />
                <path d="M508 0V460" />
                <path d="M612 0V460" />
              </g>

              {/* City blocks — main buildings */}
              <g fill="#1a1e2e" stroke="#252a3d" strokeWidth="1">
                <rect x="20" y="18" width="118" height="82" rx="5" />
                <rect x="164" y="22" width="100" height="58" rx="5" />
                <rect x="278" y="18" width="56" height="58" rx="5" />
                <rect x="352" y="16" width="74" height="60" rx="5" />
                <rect x="444" y="18" width="60" height="58" rx="5" />
                <rect x="552" y="20" width="130" height="58" rx="5" />

                <rect x="38" y="128" width="42" height="74" rx="5" />
                <rect x="100" y="128" width="60" height="74" rx="5" />
                <rect x="194" y="128" width="86" height="74" rx="5" />
                <rect x="298" y="126" width="56" height="76" rx="5" />
                <rect x="394" y="124" width="76" height="74" rx="5" />
                <rect x="490" y="128" width="80" height="70" rx="5" />
                <rect x="620" y="124" width="62" height="78" rx="5" />

                <rect x="32" y="246" width="48" height="78" rx="5" />
                <rect x="100" y="246" width="68" height="78" rx="5" />
                <rect x="194" y="244" width="86" height="78" rx="5" />
                <rect x="298" y="244" width="48" height="78" rx="5" />
                <rect x="442" y="244" width="60" height="82" rx="5" />
                <rect x="520" y="248" width="80" height="74" rx="5" />
                <rect x="622" y="248" width="60" height="74" rx="5" />

                <rect x="46" y="358" width="68" height="76" rx="5" />
                <rect x="130" y="358" width="48" height="76" rx="5" />
                <rect x="194" y="360" width="86" height="72" rx="5" />
                <rect x="298" y="356" width="56" height="78" rx="5" />
                <rect x="368" y="356" width="56" height="78" rx="5" />
                <rect x="444" y="356" width="60" height="78" rx="5" />
                <rect x="520" y="358" width="68" height="76" rx="5" />
                <rect x="606" y="356" width="76" height="78" rx="5" />
              </g>

              {/* Accent buildings — slightly lit */}
              <g fill="#1e2538" stroke="#2e3450" strokeWidth="1">
                <rect x="56" y="136" width="40" height="54" rx="4" />
                <rect x="210" y="134" width="60" height="62" rx="4" />
                <rect x="448" y="252" width="42" height="62" rx="4" />
                <rect x="556" y="26" width="60" height="46" rx="4" />
              </g>

              {/* Green spaces */}
              <g opacity="0.9">
                <rect
                  x="100"
                  y="132"
                  width="58"
                  height="66"
                  rx="20"
                  fill="#1a2e1e"
                  stroke="#243828"
                  strokeWidth="1"
                />
                <circle
                  cx="610"
                  cy="170"
                  r="22"
                  fill="#1a2e1e"
                  stroke="#243828"
                  strokeWidth="1"
                />
                <ellipse
                  cx="350"
                  cy="305"
                  rx="30"
                  ry="18"
                  fill="#1a2e1e"
                  stroke="#243828"
                  strokeWidth="1"
                />
              </g>

              {/* Subtle grid overlay */}
              <g stroke="#1a1d2a" strokeWidth="0.5" opacity="0.4">
                <path d="M0 58H700" />
                <path d="M0 116H700" />
                <path d="M0 174H700" />
                <path d="M0 232H700" />
                <path d="M0 290H700" />
                <path d="M0 406H700" />
                <path d="M88 0V460" />
                <path d="M176 0V460" />
                <path d="M264 0V460" />
                <path d="M352 0V460" />
                <path d="M440 0V460" />
                <path d="M528 0V460" />
                <path d="M616 0V460" />
              </g>

              {/* Route glow (behind route line) */}
              <g
                fill="none"
                stroke="#7c3aed"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.18"
                filter="url(#routeGlow)"
              >
                <path d={PATH_A} />
                <path d={PATH_B} />
              </g>

              {/* Route lines */}
              <g
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              >
                <path ref={pathARef} d={PATH_A} strokeDasharray="8 5" />
                <path ref={pathBRef} d={PATH_B} strokeDasharray="8 5" />
              </g>

              {/* Intersection node */}
              <circle
                cx={COLLISION_POINT.x}
                cy={COLLISION_POINT.y}
                r="5"
                fill="#8b5cf6"
                opacity="0.8"
              />
              <circle
                cx={COLLISION_POINT.x}
                cy={COLLISION_POINT.y}
                r="9"
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1"
                opacity="0.4"
              />

              {/* Vehicle A */}
              <g
                transform={`translate(${carA.x} ${carA.y}) rotate(${carA.angle})`}
                filter="url(#softGlow)"
              >
                <rect
                  x="-12"
                  y="-6"
                  width="24"
                  height="12"
                  rx="3"
                  fill="#22c55e"
                />
                <rect
                  x="-6"
                  y="-4"
                  width="12"
                  height="8"
                  rx="2"
                  fill="#0f172a"
                  opacity="0.85"
                />
                <circle cx="-9" cy="6" r="2.5" fill="#1a1a2e" />
                <circle cx="9" cy="6" r="2.5" fill="#1a1a2e" />
                <circle cx="-9" cy="-6" r="2.5" fill="#1a1a2e" />
                <circle cx="9" cy="-6" r="2.5" fill="#1a1a2e" />
                <rect
                  x="10"
                  y="-3"
                  width="4"
                  height="6"
                  rx="1"
                  fill="#fef08a"
                  opacity="0.9"
                />
              </g>

              {/* Vehicle B */}
              <g
                transform={`translate(${carB.x} ${carB.y}) rotate(${carB.angle})`}
                filter="url(#softGlow)"
              >
                <rect
                  x="-12"
                  y="-6"
                  width="24"
                  height="12"
                  rx="3"
                  fill="#f97316"
                />
                <rect
                  x="-6"
                  y="-4"
                  width="12"
                  height="8"
                  rx="2"
                  fill="#0f172a"
                  opacity="0.85"
                />
                <circle cx="-9" cy="6" r="2.5" fill="#1a1a2e" />
                <circle cx="9" cy="6" r="2.5" fill="#1a1a2e" />
                <circle cx="-9" cy="-6" r="2.5" fill="#1a1a2e" />
                <circle cx="9" cy="-6" r="2.5" fill="#1a1a2e" />
                <rect
                  x="10"
                  y="-3"
                  width="4"
                  height="6"
                  rx="1"
                  fill="#fef08a"
                  opacity="0.9"
                />
              </g>

              {/* Collision effect */}
              {collisionPulse && (
                <g
                  transform={`translate(${COLLISION_POINT.x} ${COLLISION_POINT.y})`}
                >
                  <circle r="10" fill="#ef4444" opacity="0.9" />
                  <circle r="8" fill="#fca5a5" opacity="0.6">
                    <animate
                      attributeName="r"
                      from="10"
                      to="24"
                      dur="0.4s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.7"
                      to="0"
                      dur="0.4s"
                      repeatCount="1"
                    />
                  </circle>
                  <circle
                    r="20"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2.5"
                    opacity="0"
                  >
                    <animate
                      attributeName="r"
                      from="14"
                      to="56"
                      dur="0.9s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.85"
                      to="0"
                      dur="0.9s"
                      repeatCount="1"
                    />
                  </circle>
                  <circle
                    r="40"
                    fill="none"
                    stroke="#fca5a5"
                    strokeWidth="1"
                    opacity="0"
                  >
                    <animate
                      attributeName="r"
                      from="20"
                      to="70"
                      dur="1.1s"
                      begin="0.1s"
                      repeatCount="1"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.5"
                      to="0"
                      dur="1.1s"
                      begin="0.1s"
                      repeatCount="1"
                    />
                  </circle>
                </g>
              )}

              {/* Legend */}
              <g transform="translate(16 16)">
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="66"
                  rx="6"
                  fill="#0f1117"
                  opacity="0.85"
                  stroke="#252a3d"
                  strokeWidth="1"
                />
                <circle cx="16" cy="18" r="5" fill="#22c55e" />
                <text
                  x="27"
                  y="22"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  VH-1024
                </text>
                <circle cx="16" cy="38" r="5" fill="#f97316" />
                <text
                  x="27"
                  y="42"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  VH-7842
                </text>
                <rect
                  x="11"
                  y="52"
                  width="10"
                  height="3"
                  rx="1.5"
                  fill="#8b5cf6"
                  opacity="0.9"
                />
                <text
                  x="27"
                  y="58"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  Route
                </text>
              </g>

              {/* Location badge */}
              <g
                transform={`translate(${COLLISION_POINT.x - 56} ${COLLISION_POINT.y - 34})`}
              >
                <rect
                  x="0"
                  y="0"
                  width="112"
                  height="22"
                  rx="4"
                  fill="#1e1b4b"
                  stroke="#4c1d95"
                  strokeWidth="1"
                  opacity="0.95"
                />
                <text
                  x="8"
                  y="15"
                  fill="#a78bfa"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="600"
                  letterSpacing="0.5"
                >
                  Downtown Node 17
                </text>
              </g>
            </svg>
          </CardContent>
        </Card>

        <Card className="h-[78vh] min-h-[520px] w-full">
          <CardHeader>
            <CardTitle>Collision Stream</CardTitle>
            <CardDescription>
              Realtime event feed for location, timestamps, and vehicles.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-3 overflow-hidden">
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center border border-dashed border-border text-muted-foreground">
                Press{" "}
                <span className="mx-1 font-medium text-foreground">
                  Accident
                </span>{" "}
                to start streaming events.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1">
                {events.map((event) => {
                  const label = streamLabels[event.level];
                  const formatted = formatDateTime(event.timestamp);

                  return (
                    <div
                      key={event.id}
                      className="border border-border bg-background p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <Badge variant={label.badge}>{label.text}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatted.time}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{event.status}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.message}
                      </p>
                      <Separator className="my-2" />
                      <div className="space-y-1 text-xs">
                        <p>
                          <span className="text-muted-foreground">
                            Location:
                          </span>{" "}
                          {event.location}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Coordinates:
                          </span>{" "}
                          {event.latitude}, {event.longitude}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Date:</span>{" "}
                          {formatted.date}
                        </p>
                        <p>
                          <span className="text-muted-foreground">
                            Vehicles:
                          </span>{" "}
                          {event.vehicleIds.join(" and ")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
