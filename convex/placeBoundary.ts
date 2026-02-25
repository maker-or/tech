import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

type LonLat = [number, number];
type PolygonGeometry = { type: "Polygon"; coordinates: LonLat[][] };
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: LonLat[][][] };
type PlaceGeometry = PolygonGeometry | MultiPolygonGeometry;

interface NominatimPlace {
  type?: string;
  display_name: string;
  geojson?: {
    type?: string;
    coordinates?: unknown;
  };
  boundingbox?: string[];
}

function isFiniteNumber(value: number) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function isValidLatLon(lat: number, lon: number) {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function includesIgnoreCase(values: string[], term?: string) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
}

function pointInRing(point: LonLat, ring: LonLat[]) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: LonLat, polygon: LonLat[][]) {
  if (polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

function pointInGeometry(point: LonLat, geometry: PlaceGeometry) {
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates);
  }

  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

function parseAllNumbers(text: string) {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((raw) => Number(raw)).filter((value) => Number.isFinite(value));
}

function extractCoordinateFromLocation(location: string[]) {
  const joined = location.join(" ");
  const latMatch = joined.match(/lat(?:itude)?[^\d-]*(-?\d+(?:\.\d+)?)/i);
  const lonMatch = joined.match(/lon(?:gitude)?[^\d-]*(-?\d+(?:\.\d+)?)/i);

  if (latMatch && lonMatch) {
    const lat = Number(latMatch[1]);
    const lon = Number(lonMatch[1]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  if (location.length >= 2) {
    const lat = Number(location[0]);
    const lon = Number(location[1]);
    if (isValidLatLon(lat, lon)) return { lat, lon };
  }

  for (const part of location) {
    const nums = parseAllNumbers(part);
    for (let i = 0; i + 1 < nums.length; i += 1) {
      const lat = nums[i];
      const lon = nums[i + 1];
      if (isValidLatLon(lat, lon)) return { lat, lon };
    }
  }

  return null;
}

function buildFallbackPolygonFromBbox(
  bboxValues?: number[] | null,
): PolygonGeometry | null {
  if (!bboxValues || bboxValues.length !== 4) return null;
  const [minLat, maxLat, minLon, maxLon] = bboxValues;
  if (!isValidLatLon(minLat, minLon) || !isValidLatLon(maxLat, maxLon)) {
    return null;
  }

  return {
    type: "Polygon",
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

function bestPlaceResult(items: NominatimPlace[]) {
  const preferred = items.find((item) =>
    ["administrative", "city", "state", "county", "town", "village"].includes(
      item.type ?? "",
    ),
  );

  return preferred ?? items[0];
}

function resolvePlaceGeometry(place: NominatimPlace): PlaceGeometry | null {
  const geojson = place.geojson;
  if (geojson?.type === "Polygon" && Array.isArray(geojson.coordinates)) {
    return { type: "Polygon", coordinates: geojson.coordinates as LonLat[][] };
  }

  if (geojson?.type === "MultiPolygon" && Array.isArray(geojson.coordinates)) {
    return {
      type: "MultiPolygon",
      coordinates: geojson.coordinates as LonLat[][][],
    };
  }

  const bbox = place.boundingbox?.map((entry) => Number(entry));
  return buildFallbackPolygonFromBbox(bbox ?? null);
}

function textMatchLocation(values: string[], placeName: string, displayName: string) {
  if (includesIgnoreCase(values, placeName)) return true;

  const displayTokens = displayName
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  return displayTokens.some((token) => includesIgnoreCase(values, token));
}

export const findCrashesByPlaceBoundary: any = action({
  args: {
    placeName: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    const placeUrl = new URL("https://nominatim.openstreetmap.org/search");
    placeUrl.searchParams.set("q", args.placeName);
    placeUrl.searchParams.set("format", "jsonv2");
    placeUrl.searchParams.set("addressdetails", "1");
    placeUrl.searchParams.set("polygon_geojson", "1");
    placeUrl.searchParams.set("limit", "8");

    const response = await fetch(placeUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "crash-investigation-agent/1.0",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to fetch place details from map service.");
    }

    const raw = (await response.json()) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Place not found. Try a more specific place name.");
    }

    const place = bestPlaceResult(raw as NominatimPlace[]);
    const geometry = resolvePlaceGeometry(place);
    if (!geometry) {
      throw new Error("No usable boundary available for this place.");
    }

    const scanLimit = Math.max(1, Math.min(args.limit ?? 500, 5000));
    const rows: Array<{
      timeStamp: string;
      vehicleId: string[];
      location: string[];
    }> = await ctx.runQuery((api as any).crash.listCrashesForGeoFilter, {
      startTime: args.startTime,
      endTime: args.endTime,
      limit: scanLimit,
    });

    const crashesInsideBoundary: Array<{
      timeStamp: string;
      vehicleId: string[];
      location: string[];
      coordinate: { lat: number; lon: number };
    }> = [];

    const textMatchedWithoutCoordinates: Array<{
      timeStamp: string;
      vehicleId: string[];
      location: string[];
    }> = [];

    let missingCoordinates = 0;

    for (const row of rows) {
      const coordinate = extractCoordinateFromLocation(row.location);
      if (!coordinate) {
        missingCoordinates += 1;
        if (textMatchLocation(row.location, args.placeName, place.display_name)) {
          textMatchedWithoutCoordinates.push(row);
        }
        continue;
      }

      if (pointInGeometry([coordinate.lon, coordinate.lat], geometry)) {
        crashesInsideBoundary.push({
          ...row,
          coordinate,
        });
      }
    }

    return {
      placeQuery: args.placeName,
      resolvedPlace: place.display_name,
      boundaryType: geometry.type,
      startTime: args.startTime ?? null,
      endTime: args.endTime ?? null,
      scannedRows: rows.length,
      rowsMissingCoordinates: missingCoordinates,
      matchedInsideBoundary: crashesInsideBoundary.length,
      textMatchedWithoutCoordinates: textMatchedWithoutCoordinates.length,
      crashesInsideBoundary: crashesInsideBoundary.slice(0, scanLimit),
      textMatchedRows: textMatchedWithoutCoordinates.slice(0, scanLimit),
    };
  },
});
