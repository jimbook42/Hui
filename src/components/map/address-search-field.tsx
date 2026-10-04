"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { GeocodeResult } from "@/lib/maps/geocoding";
import { roundCoordinate, type EventCoordinates } from "@/domain/events/location";

type AddressSearchFieldProps = {
  label?: string;
  value: string;
  onPlaceChange: (label: string, coordinates: EventCoordinates | null) => void;
  countryCode?: string;
};

export function AddressSearchField({
  label = "Search for an address",
  value,
  onPlaceChange,
  countryCode,
}: AddressSearchFieldProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setNotice(null);
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (countryCode) {
          params.set("country", countryCode);
        }
        const response = await fetch(`/api/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setResults([]);
          return;
        }
        const body = (await response.json()) as {
          configured?: boolean;
          results?: GeocodeResult[];
        };
        setConfigured(body.configured === true);
        setResults(Array.isArray(body.results) ? body.results : []);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, countryCode]);

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery.length >= 3 ? results : [];

  function choose(result: GeocodeResult) {
    const coordinates = {
      lat: roundCoordinate(result.lat),
      lng: roundCoordinate(result.lng),
    };
    onPlaceChange(result.label, coordinates);
    setQuery("");
    setResults([]);
    setNotice(null);
  }

  return (
    <div className="space-y-2">
      <label className="hui-label">
        <span>{label}</span>
        <input
          className="hui-input"
          value={query}
          placeholder={value.trim() ? "Search to change the place…" : "Start typing an address…"}
          onChange={(event) => setQuery(event.target.value)}
          role="combobox"
          aria-expanded={visibleResults.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </label>
      {loading ? (
        <p className="text-xs font-semibold text-muted-foreground" role="status">
          Searching…
        </p>
      ) : null}
      {configured === false ? (
        <p className="hui-message-note" role="status">
          Address search is not configured yet. Enter the place below or pin it on the map.
        </p>
      ) : null}
      {configured === true ? (
        <p className="text-xs text-muted-foreground">
          <a
            href="https://www.geoapify.com/"
            className="hui-focus-ring underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by Geoapify
          </a>
        </p>
      ) : null}
      {visibleResults.length > 0 ? (
        <ul
          id={listId}
          className="max-h-48 overflow-y-auto rounded-hui-md border border-border bg-surface hui-shadow-sm"
          role="listbox"
        >
          {visibleResults.map((result) => (
            <li key={`${result.label}-${result.lat}-${result.lng}`}>
              <button
                type="button"
                className="hui-focus-ring block w-full px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted"
                role="option"
                aria-selected={false}
                onClick={() => choose(result)}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {notice ? (
        <p className="hui-message-note" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
