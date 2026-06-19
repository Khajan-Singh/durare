import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, LocateFixed, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PickedLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type Suggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

declare global {
  interface Window {
    google?: any;
    __durareMapsCb?: () => void;
  }
}

let mapsLoader: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps key not configured"));

  mapsLoader = new Promise<void>((resolve, reject) => {
    window.__durareMapsCb = () => resolve();
    const s = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      v: "weekly",
      libraries: "places,marker",
      callback: "__durareMapsCb",
    });
    if (channel) params.set("channel", channel);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

export function LocationPicker({
  value,
  onChange,
  placeholder = "Search address or place…",
}: {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [bias, setBias] = useState<{ lat: number; lng: number } | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    loadMaps().then(() => setReady(true)).catch(() => setReady(false));
  }, []);

  // Initialize map when ready and we have a value
  useEffect(() => {
    if (!ready || !mapEl.current || !value) return;
    const g = window.google;
    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(mapEl.current, {
        center: { lat: value.lat, lng: value.lng },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapRef.current.setCenter({ lat: value.lat, lng: value.lng });
    }
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new g.maps.Marker({
      position: { lat: value.lat, lng: value.lng },
      map: mapRef.current,
    });
  }, [ready, value]);

  const runSearch = async (text: string) => {
    if (!ready || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      setLoading(true);
      const { AutocompleteSuggestion, AutocompleteSessionToken } =
        await window.google.maps.importLibrary("places");
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }
      const req: any = {
        input: text,
        sessionToken: sessionTokenRef.current,
      };
      if (bias) {
        req.locationBias = {
          circle: { center: bias, radius: 30000 },
        };
      }
      const { suggestions: out } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
      const mapped: Suggestion[] = (out ?? [])
        .map((s: any) => s.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
          placeId: p.placeId,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      setSuggestions(mapped);
      setOpen(true);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const onQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(text), 220);
  };

  const pick = async (s: Suggestion) => {
    try {
      const { Place } = await window.google.maps.importLibrary("places");
      const place = new Place({ id: s.placeId });
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "location"],
      });
      const loc = place.location;
      if (!loc) return;
      const picked: PickedLocation = {
        name: place.displayName ?? s.primary,
        address: place.formattedAddress ?? `${s.primary}, ${s.secondary}`,
        lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
        lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
      };
      setQuery(picked.name);
      setSuggestions([]);
      setOpen(false);
      sessionTokenRef.current = null; // end session
      onChange(picked);
    } catch (e) {
      console.error(e);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setBias(here);
        if (query.trim().length >= 2) runSearch(query);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="h-12 rounded-lg pl-9 pr-24"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={useMyLocation}
          className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-secondary"
          title="Use my location"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LocateFixed className="h-3.5 w-3.5" />
          )}
          Near me
        </button>

        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {s.primary}
                    </span>
                    {s.secondary && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!ready && (
        <p className="text-xs text-muted-foreground">Loading map…</p>
      )}

      {value && (
        <div className="space-y-1.5">
          <div
            ref={mapEl}
            className={cn("h-44 w-full overflow-hidden rounded-lg border border-border bg-muted")}
          />
          <p className="text-xs text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3" />
            {value.address}
          </p>
        </div>
      )}
    </div>
  );
}