import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { ServicePoint } from '../types/point.ts';
import { SERVICE_LABELS, buildGoogleMapsViewUrl } from '../types/point.ts';

interface OsmMapProps {
  points: ServicePoint[];
  selectedPointId: string | null;
  onSelectPoint: (point: ServicePoint) => void;
  isPickingLocation: boolean;
  pickedCoords: { latitud: number; longitud: number } | null;
  onPickLocation: (latitud: number, longitud: number) => void;
  fitAllTrigger: number;
}

function getMarkerPalette(servicio: ServicePoint['servicio'], isSelected: boolean) {
  if (servicio === 'inflado') {
    return {
      fill: isSelected ? '#0f766e' : '#0d9488',
      ring: '#ccfbf1',
      glyph: 'I',
    };
  }
  if (servicio === 'herramientas') {
    return {
      fill: isSelected ? '#b45309' : '#d97706',
      ring: '#fef3c7',
      glyph: 'H',
    };
  }
  return {
    fill: isSelected ? '#0f172a' : '#334155',
    ring: '#e2e8f0',
    glyph: '+',
  };
}

function createPinIcon(servicio: ServicePoint['servicio'], isSelected: boolean): L.DivIcon {
  const palette = getMarkerPalette(servicio, isSelected);
  const size = isSelected ? 40 : 32;
  const height = isSelected ? 48 : 38;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${height}" viewBox="0 0 32 38" fill="none">
      <path d="M16 1C8.268 1 2 7.268 2 15c0 9.8 11.78 20.36 13.12 21.52a1.35 1.35 0 0 0 1.76 0C18.22 35.36 30 24.8 30 15 30 7.268 23.732 1 16 1Z" fill="${palette.fill}" stroke="#ffffff" stroke-width="2.2"/>
      <circle cx="16" cy="14.5" r="8" fill="${palette.ring}"/>
      <text x="16" y="18" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif" font-size="10.5" font-weight="700" fill="${palette.fill}">${palette.glyph}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'biciposta-osm-pin',
    iconSize: [size, height],
    iconAnchor: [size / 2, height - 2],
    popupAnchor: [0, -(height - 6)],
  });
}

function createDraftPinIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40" fill="none">
      <path d="M17 2C9.82 2 4 7.82 4 15c0 9.1 11.15 19.2 12.22 20.15a1.15 1.15 0 0 0 1.56 0C18.85 34.2 30 24.1 30 15 30 7.82 24.18 2 17 2Z" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>
      <circle cx="17" cy="14.5" r="4.5" fill="#ffffff"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'biciposta-draft-pin',
    iconSize: [34, 40],
    iconAnchor: [17, 38],
  });
}

function buildPopupContent(point: ServicePoint): HTMLElement {
  const container = document.createElement('div');
  container.className = 'p-3.5 text-slate-900 space-y-2';

  const title = document.createElement('div');
  title.className = 'font-semibold text-sm leading-snug text-slate-900';
  title.textContent = point.nombre_punto;
  container.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'text-xs text-slate-600';
  meta.textContent = `${SERVICE_LABELS[point.servicio]} · ${point.horario}`;
  container.appendChild(meta);

  const ref = document.createElement('div');
  ref.className = 'text-xs text-slate-700 leading-relaxed';
  ref.textContent = point.referencia_puesto;
  container.appendChild(ref);

  const coords = document.createElement('div');
  coords.className = 'font-mono text-[11px] text-slate-500 pt-1 border-t border-slate-100';
  coords.textContent = `${point.latitud.toFixed(6)}, ${point.longitud.toFixed(6)}`;
  container.appendChild(coords);

  const linkWrap = document.createElement('div');
  linkWrap.className = 'pt-1';
  const gmapsLink = document.createElement('a');
  gmapsLink.href = buildGoogleMapsViewUrl(point.latitud, point.longitud);
  gmapsLink.target = '_blank';
  gmapsLink.rel = 'noopener noreferrer';
  gmapsLink.className =
    'inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline';
  gmapsLink.textContent = 'Ver en Google Maps';
  linkWrap.appendChild(gmapsLink);
  container.appendChild(linkWrap);

  return container;
}

export function OsmMap({
  points,
  selectedPointId,
  onSelectPoint,
  isPickingLocation,
  pickedCoords,
  onPickLocation,
  fitAllTrigger,
}: OsmMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const draftMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelectPoint);
  const onPickRef = useRef(onPickLocation);
  const isPickingRef = useRef(isPickingLocation);
  const hasFittedInitialRef = useRef(false);

  onSelectRef.current = onSelectPoint;
  onPickRef.current = onPickLocation;
  isPickingRef.current = isPickingLocation;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-34.599, -58.41],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!isPickingRef.current) return;
      const lat = Number(event.latlng.lat.toFixed(6));
      const lng = Number(event.latlng.lng.toFixed(6));
      onPickRef.current(lat, lng);
    });

    mapRef.current = map;
    markersLayerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      markerByIdRef.current.clear();
      draftMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = isPickingLocation ? 'crosshair' : '';
  }, [isPickingLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerByIdRef.current.clear();

    points.forEach((point) => {
      const isSelected = point.id === selectedPointId;
      const marker = L.marker([point.latitud, point.longitud], {
        icon: createPinIcon(point.servicio, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.bindPopup(buildPopupContent(point), {
        maxWidth: 280,
      });

      marker.on('click', () => {
        if (!isPickingRef.current) {
          onSelectRef.current(point);
        }
      });

      marker.addTo(layer);
      markerByIdRef.current.set(point.id, marker);
    });

    if (!hasFittedInitialRef.current && points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.latitud, p.longitud] as [number, number]));
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 15 });
      hasFittedInitialRef.current = true;
    }
  }, [points, selectedPointId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPointId) return;
    const selected = points.find((p) => p.id === selectedPointId);
    if (!selected) return;

    map.flyTo([selected.latitud, selected.longitud], Math.max(map.getZoom(), 15), {
      duration: 0.45,
    });

    const marker = markerByIdRef.current.get(selectedPointId);
    if (marker) {
      marker.openPopup();
    }
  }, [selectedPointId, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitAllTrigger === 0 || points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.latitud, p.longitud] as [number, number]));
    map.fitBounds(bounds, { padding: [52, 52], maxZoom: 15 });
  }, [fitAllTrigger, points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }

    if (
      isPickingLocation &&
      pickedCoords &&
      Number.isFinite(pickedCoords.latitud) &&
      Number.isFinite(pickedCoords.longitud)
    ) {
      const draft = L.marker([pickedCoords.latitud, pickedCoords.longitud], {
        icon: createDraftPinIcon(),
        zIndexOffset: 1200,
      }).addTo(map);
      draftMarkerRef.current = draft;
    }
  }, [isPickingLocation, pickedCoords]);

  return (
    <div className="relative w-full h-full min-h-[460px]">
      <div ref={containerRef} className="w-full h-full min-h-[460px] z-0" />
      {isPickingLocation && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-slate-900 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-md">
          Hacé clic en cualquier punto del mapa OpenStreetMap para capturar las coordenadas
        </div>
      )}
    </div>
  );
}
