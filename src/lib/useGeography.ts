"use client";

import { useEffect, useState } from "react";

export type GeographyProvince = { id: string; code: string; name: string };
export type GeographyDistrict = { id: string; code: string; name: string; provinceId: string };
export type GeographyLocalLevel = {
  id: string;
  code: string;
  name: string;
  type: "METROPOLITAN_CITY" | "SUB_METROPOLITAN_CITY" | "MUNICIPALITY" | "RURAL_MUNICIPALITY";
  wardCount: number;
  districtId: string;
};
export type Geography = {
  provinces: GeographyProvince[];
  districts: GeographyDistrict[];
  localLevels: GeographyLocalLevel[];
};

// Fixed reference data (see prisma/data/nepal-geography.json) — the same
// 837-row tree is reused by every AddressForm instance on a page, so one
// module-scoped fetch (shared even across concurrent mounts, via this
// single in-flight promise) is enough for the whole session.
let cache: Promise<Geography> | null = null;

function loadGeography(): Promise<Geography> {
  if (!cache) {
    cache = fetch("/api/geography").then((res) => {
      if (!res.ok) {
        cache = null; // allow a retry on the next mount after a failure
        throw new Error("Failed to load Nepal geography reference data.");
      }
      return res.json();
    });
  }
  return cache;
}

export function useGeography() {
  const [geography, setGeography] = useState<Geography | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGeography()
      .then((g) => {
        if (!cancelled) setGeography(g);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load geography data.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { geography, error };
}
