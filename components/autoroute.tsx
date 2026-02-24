"use client";

import * as React from "react";
import { AlertTriangle, Check, Loader2, Navigation } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type LatLngLiteral = { lat: number; lng: number };
type GeoPoint = LatLngLiteral | { lat: () => number; lng: () => number };

type DirectionsStatus = string;

type DirectionsRequest = {
  origin: string;
  destination: string;
  travelMode: "DRIVING";
  provideRouteAlternatives?: boolean;
  waypoints?: Array<{
    location: LatLngLiteral;
    stopover: boolean;
  }>;
};

type DirectionsStep = {
  html_instructions?: string;
  start_location: GeoPoint;
  distance?: { text: string };
};

type DirectionsLeg = {
  steps: DirectionsStep[];
  distance?: { text: string };
  duration?: { text: string };
};

type DirectionsRoute = {
  legs: DirectionsLeg[];
  overview_path: GeoPoint[];
};

type DirectionsResult = {
  routes: DirectionsRoute[];
};

type MapInstance = {
  fitBounds: (bounds: BoundsInstance) => void;
};

type BoundsInstance = {
  extend: (point: GeoPoint) => void;
};

type DirectionsRenderer = {
  setMap: (map: MapInstance | null) => void;
  setDirections: (result: DirectionsResult) => void;
  setRouteIndex: (index: number) => void;
};

type GoogleMapsApi = {
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => MapInstance;
  LatLngBounds: new () => BoundsInstance;
  DirectionsService: new () => {
    route: (
      request: DirectionsRequest,
      callback: (
        result: DirectionsResult | null,
        status: DirectionsStatus,
      ) => void,
    ) => void;
  };
  DirectionsRenderer: new (options: Record<string, unknown>) => DirectionsRenderer;
};

declare global {
  interface Window {
    google?: {
      maps: GoogleMapsApi;
    };
  }
}

type CenterPoint = {
  id: string;
  title: string;
  detail: string;
  location: LatLngLiteral;
};

const GOOGLE_MAPS_SCRIPT_ID = "autoroute-google-maps-script";
const MAX_CENTERS = 7;
const ALTERNATE_SAFE_RADIUS_METERS = 350;
const DETOUR_OFFSET_DEGREES = 0.016;

function toLiteral(point: GeoPoint): LatLngLiteral {
  if (typeof point.lat === "function") {
    return { lat: point.lat(), lng: point.lng() };
  }
  return point;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function haversineMeters(a: LatLngLiteral, b: LatLngLiteral) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const q =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function buildBypassWaypoints(point: LatLngLiteral): [LatLngLiteral, LatLngLiteral] {
  const left = {
    lat: point.lat + DETOUR_OFFSET_DEGREES,
    lng: point.lng - DETOUR_OFFSET_DEGREES,
  };
  const right = {
    lat: point.lat - DETOUR_OFFSET_DEGREES,
    lng: point.lng + DETOUR_OFFSET_DEGREES,
  };
  return [left, right];
}

function centersFromRoute(route: DirectionsRoute) {
  const firstLeg = route.legs[0];
  if (!firstLeg?.steps?.length) {
    return [];
  }

  const sampledStepIndexes = new Set<number>([0, firstLeg.steps.length - 1]);
  const stride = Math.max(1, Math.floor(firstLeg.steps.length / MAX_CENTERS));
  for (let i = 0; i < firstLeg.steps.length; i += stride) {
    sampledStepIndexes.add(i);
  }

  const sorted = [...sampledStepIndexes].sort((a, b) => a - b).slice(0, MAX_CENTERS);

  return sorted.map((stepIndex, idx) => {
    const step = firstLeg.steps[stepIndex];
    const instruction =
      stripHtml(step.html_instructions || "") || `Center ${idx + 1}`;

    return {
      id: `${stepIndex}-${idx}`,
      title: instruction,
      detail: step.distance?.text || "Along route",
      location: toLiteral(step.start_location),
    };
  });
}

function mapReady() {
  return typeof window !== "undefined" && !!window.google?.maps;
}

async function loadGoogleMaps(apiKey: string) {
  if (mapReady()) {
    return;
  }

  const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as
    | HTMLScriptElement
    | null;

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (mapReady()) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), {
        once: true,
      });
    });
    return;
  }

  const script = document.createElement("script");
  script.id = GOOGLE_MAPS_SCRIPT_ID;
  script.async = true;
  script.defer = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;

  await new Promise<void>((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

export function AutoRoute() {
  const [onboardingPoint, setOnboardingPoint] = React.useState("");
  const [dropoffPoint, setDropoffPoint] = React.useState("");
  const [centers, setCenters] = React.useState<CenterPoint[]>([]);
  const [selectedAccidentCenterId, setSelectedAccidentCenterId] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<{ distance: string; duration: string } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = React.useState(false);
  const [error, setError] = React.useState("");

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapInstance | null>(null);
  const rendererRef = React.useRef<DirectionsRenderer | null>(null);
  const directionsServiceRef = React.useRef<ReturnType<GoogleMapsApi["DirectionsService"]> | null>(null);
  const initialResultRef = React.useRef<DirectionsResult | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const requestRoute = React.useCallback(
    (request: DirectionsRequest) =>
      new Promise<DirectionsResult>((resolve, reject) => {
        const service = directionsServiceRef.current;
        if (!service) {
          reject(new Error("Directions service is unavailable."));
          return;
        }

        service.route(request, (result, status) => {
          if (!result || status !== "OK") {
            reject(new Error(`Directions failed with status: ${status}`));
            return;
          }
          resolve(result);
        });
      }),
    [],
  );

  React.useEffect(() => {
    let isMounted = true;

    async function initializeMap() {
      if (!apiKey) {
        setError("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment.");
        return;
      }
      if (!mapContainerRef.current) {
        return;
      }

      try {
        await loadGoogleMaps(apiKey);
        if (!isMounted || !mapContainerRef.current || !window.google?.maps) {
          return;
        }

        const maps = window.google.maps;
        mapRef.current = new maps.Map(mapContainerRef.current, {
          center: { lat: 37.7749, lng: -122.4194 },
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });

        rendererRef.current = new maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: "#2563eb",
            strokeWeight: 7,
            strokeOpacity: 0.95,
          },
        });

        directionsServiceRef.current = new maps.DirectionsService();
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to initialize map.");
      }
    }

    void initializeMap();

    return () => {
      isMounted = false;
      rendererRef.current?.setMap(null);
    };
  }, [apiKey]);

  const renderRoute = React.useCallback((result: DirectionsResult, routeIndex = 0) => {
    const renderer = rendererRef.current;
    if (!renderer) {
      throw new Error("Map renderer is unavailable.");
    }

    renderer.setDirections(result);
    renderer.setRouteIndex(routeIndex);

    const selectedRoute = result.routes[routeIndex];
    const bounds = window.google?.maps ? new window.google.maps.LatLngBounds() : null;
    if (mapRef.current && bounds) {
      selectedRoute.overview_path.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds);
    }

    const leg = selectedRoute.legs[0];
    setSummary({
      distance: leg?.distance?.text || "n/a",
      duration: leg?.duration?.text || "n/a",
    });
  }, []);

  const chooseDetourFromAlternatives = React.useCallback(
    (center: CenterPoint, result: DirectionsResult) => {
      let bestIndex = -1;
      let bestMinDistance = -1;

      result.routes.forEach((route, routeIndex) => {
        if (routeIndex === 0) {
          return;
        }

        const locations = route.legs[0]?.steps.map((step) => toLiteral(step.start_location)) ?? [];
        if (!locations.length) {
          return;
        }

        const minDistance = locations.reduce((min, location) => {
          const distance = haversineMeters(location, center.location);
          return Math.min(min, distance);
        }, Number.POSITIVE_INFINITY);

        if (minDistance > bestMinDistance) {
          bestMinDistance = minDistance;
          bestIndex = routeIndex;
        }
      });

      if (bestIndex > -1 && bestMinDistance > ALTERNATE_SAFE_RADIUS_METERS) {
        return bestIndex;
      }

      return null;
    },
    [],
  );

  const startRouting = React.useCallback(async () => {
    if (!onboardingPoint.trim() || !dropoffPoint.trim()) {
      setError("Enter both onboarding and drop-off points.");
      return;
    }
    if (!directionsServiceRef.current || !rendererRef.current) {
      setError("Map is still initializing. Try again in a moment.");
      return;
    }

    setIsLoadingRoute(true);
    setError("");
    setSelectedAccidentCenterId(null);

    try {
      const result = await requestRoute({
        origin: onboardingPoint.trim(),
        destination: dropoffPoint.trim(),
        travelMode: "DRIVING",
        provideRouteAlternatives: true,
      });

      initialResultRef.current = result;
      renderRoute(result, 0);
      setCenters(centersFromRoute(result.routes[0]));
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Could not generate route.");
      setCenters([]);
      setSummary(null);
      initialResultRef.current = null;
    } finally {
      setIsLoadingRoute(false);
    }
  }, [dropoffPoint, onboardingPoint, renderRoute, requestRoute]);

  const handleCenterToggle = React.useCallback(
    async (center: CenterPoint) => {
      if (!initialResultRef.current) {
        return;
      }

      const nextSelectedId = selectedAccidentCenterId === center.id ? null : center.id;
      setSelectedAccidentCenterId(nextSelectedId);
      setError("");

      if (!nextSelectedId) {
        renderRoute(initialResultRef.current, 0);
        return;
      }

      setIsLoadingRoute(true);
      try {
        const detourIndex = chooseDetourFromAlternatives(center, initialResultRef.current);
        if (detourIndex !== null) {
          renderRoute(initialResultRef.current, detourIndex);
          return;
        }

        const [leftBypass, rightBypass] = buildBypassWaypoints(center.location);
        const detourResult = await requestRoute({
          origin: onboardingPoint.trim(),
          destination: dropoffPoint.trim(),
          travelMode: "DRIVING",
          provideRouteAlternatives: false,
          waypoints: [
            { location: leftBypass, stopover: false },
            { location: rightBypass, stopover: false },
          ],
        });
        renderRoute(detourResult, 0);
      } catch (detourError) {
        renderRoute(initialResultRef.current, 0);
        setSelectedAccidentCenterId(null);
        setError(
          detourError instanceof Error
            ? `Detour unavailable: ${detourError.message}`
            : "Could not apply detour.",
        );
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [
      chooseDetourFromAlternatives,
      dropoffPoint,
      onboardingPoint,
      renderRoute,
      requestRoute,
      selectedAccidentCenterId,
    ],
  );

  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[7fr_3fr]">
        <Card className="h-[86vh] min-h-[560px] overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  AutoRoute
                </CardTitle>
                <CardDescription>
                  Route-only map view. Mark an accident point to force a detour.
                </CardDescription>
              </div>
              {summary ? (
                <div className="flex gap-2">
                  <Badge variant="secondary">{summary.distance}</Badge>
                  <Badge variant="outline">{summary.duration}</Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-5.5rem)] p-4 pt-0">
            <div ref={mapContainerRef} className="h-full w-full rounded-xl border border-border" />
          </CardContent>
        </Card>

        <Card className="h-[86vh] min-h-[560px]">
          <CardHeader>
            <CardTitle>Route Controls</CardTitle>
            <CardDescription>
              Enter onboarding and drop-off. Then select a center to flag an accident.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-6.5rem)] flex-col gap-4 overflow-hidden">
            <div className="space-y-3">
              <Input
                value={onboardingPoint}
                onChange={(event) => setOnboardingPoint(event.target.value)}
                placeholder="Onboarding point"
              />
              <Input
                value={dropoffPoint}
                onChange={(event) => setDropoffPoint(event.target.value)}
                placeholder="Drop-off point"
              />
              <Button className="w-full" onClick={startRouting} disabled={isLoadingRoute}>
                {isLoadingRoute ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Routing...
                  </>
                ) : (
                  "Start"
                )}
              </Button>
            </div>

            <Separator />

            <div className="space-y-3 overflow-y-auto pr-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Important centers on route</p>
                <Badge variant="outline">{centers.length}</Badge>
              </div>

              {centers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Start routing to list centers and checkpoints here.
                </div>
              ) : (
                <div className="space-y-2">
                  {centers.map((center) => {
                    const selected = selectedAccidentCenterId === center.id;
                    return (
                      <button
                        key={center.id}
                        type="button"
                        onClick={() => void handleCenterToggle(center)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? "border-destructive bg-destructive text-destructive-foreground"
                              : "border-border bg-background"
                          }`}
                          aria-hidden="true"
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 block text-sm font-medium">
                            {center.title}
                          </span>
                          <span className="text-muted-foreground text-xs">{center.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedAccidentCenterId ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                Selected center is treated as an accident location. Showing detour route.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
