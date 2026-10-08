import { useCallback, useRef } from 'react';

export interface OutdoorProof {
  durationSec: number;
  distanceM?: number;
}

interface GeoPoint {
  lat: number;
  lon: number;
}

function getPosition(timeoutMs: number, maximumAgeMs: number): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: maximumAgeMs }
    );
  });
}

function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Best-effort field proof that the explorer actually went outside:
 * time elapsed since the mission started + straight-line distance walked.
 * Never throws and never blocks the quest: geolocation failures simply
 * reduce the proof to a duration.
 */
export function useOutdoorProof() {
  const startRef = useRef<{ at: number; geo: GeoPoint | null } | null>(null);

  const beginMission = useCallback(() => {
    startRef.current = { at: Date.now(), geo: null };
    // A cached fix (<=60s) is acceptable here: instant answer, no prompt delay.
    getPosition(8000, 60000).then((geo) => {
      if (startRef.current && geo) {
        startRef.current.geo = geo;
      }
    });
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
  }, []);

  const collect = useCallback(async (): Promise<OutdoorProof | undefined> => {
    const start = startRef.current;
    if (!start) return undefined;

    const durationSec = Math.max(0, Math.round((Date.now() - start.at) / 1000));
    // Require a near-fresh fix at the end so the distance is not measured
    // against a stale starting position.
    const endGeo = await getPosition(5000, 5000);
    const distanceM =
      start.geo && endGeo ? Math.round(haversineMeters(start.geo, endGeo)) : undefined;

    return distanceM === undefined ? { durationSec } : { durationSec, distanceM };
  }, []);

  return { beginMission, reset, collect };
}
