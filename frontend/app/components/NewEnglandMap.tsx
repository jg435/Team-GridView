"use client";
import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

// FIPS state codes for ISO-NE balancing authority territory
const NE_STATE_FIPS = new Set(["09", "23", "25", "33", "44", "50"]); // CT, ME, MA, NH, RI, VT

interface Pin {
  id: string;
  label: string;
  short: string;
  coords: [number, number];   // [lng, lat]
  priority: 1 | 2 | 3 | 4 | 5;
  inviolable: boolean;
  mw: number;
}

const PINS: Pin[] = [
  { id: "hanscom_afb",      label: "Hanscom AFB",                 short: "HAFB",        coords: [-71.289, 42.470], priority: 1, inviolable: true,  mw: 18 },
  { id: "mass_general",     label: "Massachusetts General Hospital", short: "MGH",     coords: [-71.069, 42.363], priority: 2, inviolable: true,  mw: 12 },
  { id: "boston_childrens", label: "Boston Children's Hospital UPS", short: "BCH",     coords: [-71.105, 42.337], priority: 2, inviolable: true,  mw: 8 },
  { id: "hyperscaler_dc",   label: "Hyperscaler AI data center",   short: "DC",         coords: [-71.616, 42.269], priority: 5, inviolable: false, mw: 800 },
];

// fallback: where each pin's label sits relative to the marker
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor: "start" | "end" | "middle" }> = {
  hanscom_afb:      { dx: 0,  dy: -8, anchor: "middle" },
  mass_general:     { dx: 8,  dy: 3,  anchor: "start" },
  boston_childrens: { dx: 8,  dy: 12, anchor: "start" },
  hyperscaler_dc:   { dx: -8, dy: 3,  anchor: "end" },
};

// Default view: fits all 6 NE states + slight bleed into NY/Atlantic for context.
// Center ≈ centroid of New England; scale tuned empirically against the
// us-atlas topojson so CT, RI, MA, NH, VT, ME all visible.
const DEFAULT_CENTER: [number, number] = [-70.3, 44.2];
const DEFAULT_ZOOM = 1;          // ZoomableGroup multiplier on top of base scale
const BASE_SCALE = 4200;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 6;

export default function NewEnglandMap() {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const reset = () => { setCenter(DEFAULT_CENTER); setZoom(DEFAULT_ZOOM); };

  // Pin / label radius scales inversely with zoom so they don't grow huge when zoomed in.
  const pinR = 4.5 / Math.max(0.7, zoom);
  const haloR = 8 / Math.max(0.7, zoom);
  const labelSize = 9 / Math.max(0.7, zoom);
  const labelStroke = 2.5 / Math.max(0.7, zoom);
  const stateStroke = 0.5 / Math.max(0.7, zoom);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs uppercase tracking-widest text-zinc-500">ISO-NE · drag to pan · scroll to zoom</div>
        <button
          onClick={reset}
          className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-800 hover:border-zinc-700"
        >
          Reset view
        </button>
      </div>
      <div className="flex-1 min-h-0 rounded border border-zinc-800 overflow-hidden bg-zinc-950">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: BASE_SCALE, center: DEFAULT_CENTER }}
          width={340}
          height={260}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onMoveEnd={({ coordinates, zoom }) => { setCenter(coordinates); setZoom(zoom); }}
          >
            <Geographies geography="/us-states-10m.json">
              {({ geographies }) =>
                geographies.map((geo) => {
                  const isNE = NE_STATE_FIPS.has(geo.id as string);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isNE ? "#1e293b" : "#0f0f12"}
                      stroke={isNE ? "#475569" : "#27272a"}
                      strokeWidth={stateStroke}
                      style={{
                        default: { outline: "none" },
                        hover:   { outline: "none", fill: isNE ? "#334155" : "#0f0f12", cursor: "grab" },
                        pressed: { outline: "none", cursor: "grabbing" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {PINS.map((p) => {
              const off = LABEL_OFFSETS[p.id];
              const fill = p.inviolable ? "#10b981" : "#a78bfa";
              return (
                <Marker key={p.id} coordinates={p.coords}>
                  <circle r={haloR} fill={fill} fillOpacity={0.15} />
                  <circle r={pinR} fill={fill} stroke="#0a0a0a" strokeWidth={1 / Math.max(0.7, zoom)} opacity={0.95} />
                  <text
                    x={off.dx / Math.max(0.7, zoom)}
                    y={off.dy / Math.max(0.7, zoom)}
                    textAnchor={off.anchor}
                    fontSize={labelSize}
                    fontFamily="ui-monospace, monospace"
                    fill={p.inviolable ? "#34d399" : "#c4b5fd"}
                    style={{ paintOrder: "stroke", stroke: "#0a0a0a", strokeWidth: labelStroke, strokeLinejoin: "round", pointerEvents: "none" }}
                  >
                    {p.short}
                  </text>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>
      <div className="text-[10px] text-zinc-600 mt-1.5 leading-tight">
        <span className="text-emerald-400">●</span> inviolable priority loads ·
        <span className="text-purple-300 ml-1">●</span> hyperscaler data center (curtailable)
      </div>
    </div>
  );
}
