"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Navigation } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type LatLngLiteral = { lat: number; lng: number };

type OsrmStep = {
  distance: number;
  maneuver: {
    location: [number, number];
  };
};

type OsrmLeg = {
  distance: number;
  duration: number;
  steps: OsrmStep[];
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: OsrmLeg[];
};

type OsrmResponse = {
  code: string;
  routes: OsrmRoute[];
};

type LeafletMapClickEvent = {
  latlng: { lat: number; lng: number };
};

type LeafletMap = {
  fitBounds: (bounds: LeafletBounds, options?: { padding?: [number, number] }) => void;
  setView: (center: [number, number], zoom: number) => LeafletMap;
  removeLayer: (layer: LeafletLayer) => void;
  on: (event: "click", handler: (event: LeafletMapClickEvent) => void) => void;
  off: (event: "click", handler: (event: LeafletMapClickEvent) => void) => void;
};

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindPopup?: (content: string) => LeafletLayer;
};

type LeafletBounds = {
  extend: (point: [number, number]) => void;
};

type LeafletApi = {
  map: (element: HTMLElement) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  latLngBounds: (points: [number, number][]) => LeafletBounds;
  polyline: (
    latlngs: [number, number][],
    options?: Record<string, unknown>,
  ) => LeafletLayer;
  circleMarker: (
    latlng: [number, number],
    options?: Record<string, unknown>,
  ) => LeafletLayer;
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

const LEAFLET_SCRIPT_ID = "autoroute-leaflet-script";
const LEAFLET_STYLE_ID = "autoroute-leaflet-style";
const ALTERNATE_SAFE_RADIUS_METERS = 350;
const DETOUR_OFFSET_DEGREES = 0.016;

// Google Maps implementation is intentionally disabled.
// const GOOGLE_MAPS_SCRIPT_ID = "autoroute-google-maps-script";
// const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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

function metersToText(meters: number) {
  if (!Number.isFinite(meters)) return "n/a";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function secondsToText(seconds: number) {
  if (!Number.isFinite(seconds)) return "n/a";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

async function ensureLeafletLoaded() {
  if (typeof window === "undefined") {
    throw new Error("Leaflet can only load in the browser.");
  }
  if (window.L) {
    return window.L;
  }

  let style = document.getElementById(LEAFLET_STYLE_ID) as HTMLLinkElement | null;
  if (!style) {
    style = document.createElement("link");
    style.id = LEAFLET_STYLE_ID;
    style.rel = "stylesheet";
    style.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(style);
  }

  const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as
    | HTMLScriptElement
    | null;

  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.L) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Leaflet failed to load.")),
        { once: true },
      );
    });
  } else {
    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

    await new Promise<void>((resolve, reject) => {
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Leaflet failed to load.")),
        { once: true },
      );
      document.head.appendChild(script);
    });
  }

  if (!window.L) {
    throw new Error("Leaflet did not initialize correctly.");
  }

  return window.L;
}

async function geocodePlace(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Unable to resolve location.");
  }

  const payload = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`Location not found: ${query}`);
  }

  return {
    lat: Number(payload[0].lat),
    lng: Number(payload[0].lon),
  };
}

async function routeWithOsrm(args: {
  origin: string;
  destination: string;
  alternatives: boolean;
  waypoints?: LatLngLiteral[];
}) {
  const originPoint = await geocodePlace(args.origin);
  const destinationPoint = await geocodePlace(args.destination);

  const waypointCoords = (args.waypoints ?? []).map((wp) => `${wp.lng},${wp.lat}`);
  const allCoords = [
    `${originPoint.lng},${originPoint.lat}`,
    ...waypointCoords,
    `${destinationPoint.lng},${destinationPoint.lat}`,
  ].join(";");

  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${allCoords}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");
  url.searchParams.set("alternatives", args.alternatives ? "true" : "false");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Routing service is unavailable.");
  }

  const payload = (await response.json()) as OsrmResponse;
  if (payload.code !== "Ok" || !payload.routes?.length) {
    throw new Error("Could not generate route.");
  }

  return payload;
}

function formatLatLng(point: LatLngLiteral) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export function AutoRoute() {
  const [onboardingPoint, setOnboardingPoint] = React.useState("");
  const [dropoffPoint, setDropoffPoint] = React.useState("");
  const [confirmedAccidentPoint, setConfirmedAccidentPoint] =
    React.useState<LatLngLiteral | null>(null);
  const [pendingAccidentPoint, setPendingAccidentPoint] = React.useState<LatLngLiteral | null>(
    null,
  );
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<{ distance: string; duration: string } | null>(
    null,
  );
  const [isLoadingRoute, setIsLoadingRoute] = React.useState(false);
  const [error, setError] = React.useState("");

  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const routeLayerRef = React.useRef<LeafletLayer | null>(null);
  const accidentLayerRef = React.useRef<LeafletLayer | null>(null);
  const initialResultRef = React.useRef<OsrmResponse | null>(null);

  const renderAccidentMarker = React.useCallback(async (accidentPoint: LatLngLiteral | null) => {
    const map = mapRef.current;
    if (!map) return;

    if (accidentLayerRef.current) {
      map.removeLayer(accidentLayerRef.current);
      accidentLayerRef.current = null;
    }

    if (!accidentPoint) {
      return;
    }

    const L = await ensureLeafletLoaded();
    const marker = L.circleMarker([accidentPoint.lat, accidentPoint.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#dc2626",
      fillOpacity: 1,
    }).addTo(map);

    marker.bindPopup?.(`<b>Accident point</b><br/>${formatLatLng(accidentPoint)}`);
    accidentLayerRef.current = marker;
  }, []);

  const renderRoute = React.useCallback(
    async (result: OsrmResponse, routeIndex = 0, accidentPoint: LatLngLiteral | null = null) => {
      const map = mapRef.current;
      if (!map) {
        throw new Error("Map renderer is unavailable.");
      }

      const L = await ensureLeafletLoaded();
      const selectedRoute = result.routes[routeIndex];
      if (!selectedRoute) {
        throw new Error("Route index is unavailable.");
      }

      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }

      const latLngs = selectedRoute.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );

      routeLayerRef.current = L.polyline(latLngs, {
        color: "#2563eb",
        weight: 6,
        opacity: 0.92,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(latLngs), { padding: [25, 25] });

      const leg = selectedRoute.legs[0];
      setSummary({
        distance: metersToText(leg?.distance ?? selectedRoute.distance),
        duration: secondsToText(leg?.duration ?? selectedRoute.duration),
      });

      await renderAccidentMarker(accidentPoint);
    },
    [renderAccidentMarker],
  );

  const chooseDetourFromAlternatives = React.useCallback(
    (accidentPoint: LatLngLiteral, result: OsrmResponse) => {
      let bestIndex = -1;
      let bestMinDistance = -1;

      result.routes.forEach((route, routeIndex) => {
        if (routeIndex === 0) return;

        const locations =
          route.legs[0]?.steps.map((step) => {
            const [lng, lat] = step.maneuver.location;
            return { lat, lng };
          }) ?? [];

        if (!locations.length) return;

        const minDistance = locations.reduce((min, location) => {
          const distance = haversineMeters(location, accidentPoint);
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

  const applyAccidentRouting = React.useCallback(
    async (accidentPoint: LatLngLiteral | null, baseResult: OsrmResponse) => {
      if (!accidentPoint) {
        await renderRoute(baseResult, 0, null);
        return;
      }

      const detourIndex = chooseDetourFromAlternatives(accidentPoint, baseResult);
      if (detourIndex !== null) {
        await renderRoute(baseResult, detourIndex, accidentPoint);
        return;
      }

      const [leftBypass, rightBypass] = buildBypassWaypoints(accidentPoint);
      const detourResult = await routeWithOsrm({
        origin: onboardingPoint.trim(),
        destination: dropoffPoint.trim(),
        alternatives: false,
        waypoints: [leftBypass, rightBypass],
      });

      await renderRoute(detourResult, 0, accidentPoint);
    },
    [chooseDetourFromAlternatives, dropoffPoint, onboardingPoint, renderRoute],
  );

  React.useEffect(() => {
    let isMounted = true;
    let mapClickHandler: ((event: LeafletMapClickEvent) => void) | null = null;

    async function initializeMap() {
      if (!mapContainerRef.current) return;

      try {
        const L = await ensureLeafletLoaded();
        if (!isMounted || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current).setView([17.385, 78.4867], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        mapClickHandler = (event) => {
          setPendingAccidentPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
          setIsConfirmDialogOpen(true);
        };

        map.on("click", mapClickHandler);
        mapRef.current = map;
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to initialize map.");
      }
    }

    void initializeMap();

    return () => {
      isMounted = false;
      if (mapRef.current && mapClickHandler) {
        mapRef.current.off("click", mapClickHandler);
      }
    };
  }, []);

  const startRouting = React.useCallback(async () => {
    if (!onboardingPoint.trim() || !dropoffPoint.trim()) {
      setError("Enter both onboarding and drop-off points.");
      return;
    }
    if (!mapRef.current) {
      setError("Map is still initializing. Try again in a moment.");
      return;
    }

    setIsLoadingRoute(true);
    setError("");

    try {
      const result = await routeWithOsrm({
        origin: onboardingPoint.trim(),
        destination: dropoffPoint.trim(),
        alternatives: true,
      });

      initialResultRef.current = result;
      await applyAccidentRouting(confirmedAccidentPoint, result);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Could not generate route.");
      setSummary(null);
      initialResultRef.current = null;
      await renderAccidentMarker(confirmedAccidentPoint);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [
    applyAccidentRouting,
    confirmedAccidentPoint,
    dropoffPoint,
    onboardingPoint,
    renderAccidentMarker,
  ]);

  const confirmAccidentPoint = React.useCallback(async () => {
    if (!pendingAccidentPoint) return;

    const selectedPoint = pendingAccidentPoint;
    setPendingAccidentPoint(null);
    setIsConfirmDialogOpen(false);
    setConfirmedAccidentPoint(selectedPoint);
    setError("");

    if (!initialResultRef.current) {
      await renderAccidentMarker(selectedPoint);
      return;
    }

    setIsLoadingRoute(true);
    try {
      await applyAccidentRouting(selectedPoint, initialResultRef.current);
    } catch (detourError) {
      await renderRoute(initialResultRef.current, 0, null);
      setConfirmedAccidentPoint(null);
      setError(
        detourError instanceof Error
          ? `Detour unavailable: ${detourError.message}`
          : "Could not apply detour.",
      );
    } finally {
      setIsLoadingRoute(false);
    }
  }, [applyAccidentRouting, pendingAccidentPoint, renderAccidentMarker, renderRoute]);

  const clearAccidentPoint = React.useCallback(async () => {
    setConfirmedAccidentPoint(null);
    setPendingAccidentPoint(null);
    setIsConfirmDialogOpen(false);
    setError("");

    if (!initialResultRef.current) {
      await renderAccidentMarker(null);
      return;
    }

    setIsLoadingRoute(true);
    try {
      await applyAccidentRouting(null, initialResultRef.current);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Could not reset route.");
    } finally {
      setIsLoadingRoute(false);
    }
  }, [applyAccidentRouting, renderAccidentMarker]);

  return (
    <>
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
                    Leaflet + OpenStreetMap route view. Click anywhere on map to mark accident.
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
              <div
                ref={mapContainerRef}
                className="relative z-0 h-full w-full rounded-xl border border-border"
              />
            </CardContent>
          </Card>

          <Card className="h-[86vh] min-h-[560px]">
            <CardHeader>
              <CardTitle>Route Controls</CardTitle>
              <CardDescription>
                Enter onboarding and drop-off. Then click on map and confirm accident location.
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

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Accident point</p>
                {confirmedAccidentPoint ? (
                  <>
                    <p className="text-xs text-muted-foreground">{formatLatLng(confirmedAccidentPoint)}</p>
                    <Button variant="outline" size="sm" onClick={() => void clearAccidentPoint()}>
                      Clear accident point
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No accident point selected. Click on map to choose one.
                  </p>
                )}
              </div>

              {confirmedAccidentPoint ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  Confirmed accident location is active. Showing detour route.
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

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="z-[1001]">
          <DialogHeader>
            <DialogTitle>Confirm Accident Point</DialogTitle>
            <DialogDescription>
              {pendingAccidentPoint
                ? `Use ${formatLatLng(pendingAccidentPoint)} as accident location?`
                : "Choose a point on map."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmAccidentPoint()} disabled={!pendingAccidentPoint}>
              Confirm and reroute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
