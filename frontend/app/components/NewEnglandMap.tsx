"use client";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

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

export default function NewEnglandMap() {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1.5">ISO-NE territory · pinned loads</div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 5500, center: [-71.3, 43.6] }}
          width={340}
          height={260}
          style={{ width: "100%", height: "auto" }}
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
                    strokeWidth={isNE ? 0.5 : 0.3}
                    style={{
                      default: { outline: "none" },
                      hover:   { outline: "none", fill: isNE ? "#334155" : "#0f0f12" },
                      pressed: { outline: "none" },
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
                <circle r={4.5} fill={fill} stroke="#0a0a0a" strokeWidth={1} opacity={0.95} />
                <circle r={8} fill={fill} fillOpacity={0.15} />
                <text
                  x={off.dx}
                  y={off.dy}
                  textAnchor={off.anchor}
                  fontSize={9}
                  fontFamily="ui-monospace, monospace"
                  fill={p.inviolable ? "#34d399" : "#c4b5fd"}
                  style={{ paintOrder: "stroke", stroke: "#0a0a0a", strokeWidth: 2.5, strokeLinejoin: "round" }}
                >
                  {p.short}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>
      <div className="text-[10px] text-zinc-600 mt-1.5 leading-tight">
        <span className="text-emerald-400">●</span> inviolable priority loads ·
        <span className="text-purple-300 ml-1">●</span> hyperscaler data center (curtailable)
      </div>
    </div>
  );
}
