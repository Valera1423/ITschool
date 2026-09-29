import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { University } from '@/types';
import { getCityCoord } from '@/lib/cities';
import { StatusBadge, Avatar } from '@/components/ui';
import { HEX_COLORS, STATUS_COLOR_NAMES } from '@/lib/colors';

// Фикс иконок Leaflet (они подгружаются по относительному пути)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/**
 * Цвет маркера по статусу — читается из lib/colors.ts.
 * Единый источник палитры (см. statusColor ниже).
 */
function statusColor(status: string): string {
  const colorName = STATUS_COLOR_NAMES[status] ?? 'slate';
  return HEX_COLORS[colorName];
}

interface Props {
  universities: University[];
  onSelect?: (u: University) => void;
}

/**
 * Автоматически подгоняет карту под все маркеры.
 */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;

    if (points.length === 1) {
      map.setView(points[0], 10);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);

  return null;
}

export function UniversitiesMap({ universities, onSelect }: Props) {
  // Группируем вузы по координатам
  const points = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; unis: University[]; city: string }>();

    for (const u of universities) {
      const coord = getCityCoord(u.city);
      const key = `${coord.lat.toFixed(2)},${coord.lng.toFixed(2)}`;

      const existing = map.get(key);
      if (existing) {
        existing.unis.push(u);
      } else {
        map.set(key, {
          lat: coord.lat,
          lng: coord.lng,
          unis: [u],
          city: u.city,
        });
      }
    }

    return Array.from(map.values());
  }, [universities]);

  const allPoints = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points],
  );

  // Для одного вуза — обычный маркер
  if (universities.length === 1) {
    const u = universities[0];
    const coord = getCityCoord(u.city);

    return (
      <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft overflow-hidden">
        <MapContainer
          center={[coord.lat, coord.lng]}
          zoom={10}
          style={{ height: 500, width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[coord.lat, coord.lng]}>
            <Popup>
              <div className="text-sm">
                <strong>{u.name}</strong>
                <br />
                {u.city}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    );
  }

  return (
    <div className="bg-atmr-bg-surface1 rounded-atmr-xl border border-atmr-border-soft overflow-hidden">
      <MapContainer
        center={[55.7558, 37.6173]}
        zoom={4}
        style={{ height: 600, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        {points.map((p, i) => {
          const radius = Math.max(8, Math.min(30, 6 + p.unis.length * 1.5));
          const dominantStatus = p.unis[0]?.status ?? 'Новый';
          const color = statusColor(dominantStatus);

          return (
            <CircleMarker
              key={i}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.5,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <p className="font-semibold mb-2">
                    {p.city} · {p.unis.length} вуз{p.unis.length > 1 ? 'ов' : ''}
                  </p>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {p.unis.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => onSelect?.(u)}
                        className="w-full text-left flex items-center gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Avatar name={u.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-400">{u.manager}</p>
                        </div>
                        <StatusBadge status={u.status} />
                      </button>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}