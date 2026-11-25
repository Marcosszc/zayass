export type ServiceType = 'inflado' | 'herramientas' | 'inflado y herramientas';

export type ServiceFilter = 'todos' | 'inflado' | 'herramientas';

export interface ServicePoint {
  id: string;
  nombre_punto: string;
  latitud: number;
  longitud: number;
  servicio: ServiceType;
  horario: string;
  referencia_puesto: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServicePointInput {
  nombre_punto: string;
  latitud: number;
  longitud: number;
  servicio: ServiceType;
  horario: string;
  referencia_puesto: string;
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  inflado: 'Inflado',
  herramientas: 'Herramientas',
  'inflado y herramientas': 'Inflado y herramientas',
};

export function validateDecimalCoordinate(
  value: unknown,
  min: number,
  max: number,
  label: string
): { valid: boolean; numberValue: number; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: false, numberValue: NaN, error: `Ingresá la ${label} en grados decimales.` };
  }
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    return { valid: false, numberValue: NaN, error: `La ${label} debe ser un número decimal válido.` };
  }
  if (num < min || num > max) {
    return {
      valid: false,
      numberValue: num,
      error: `La ${label} debe estar entre ${min} y ${max} grados decimales.`,
    };
  }
  return { valid: true, numberValue: Number(num.toFixed(6)) };
}

export function matchesServiceFilter(servicio: ServiceType, filter: ServiceFilter): boolean {
  if (filter === 'todos') return true;
  if (filter === 'inflado') {
    return servicio === 'inflado' || servicio === 'inflado y herramientas';
  }
  if (filter === 'herramientas') {
    return servicio === 'herramientas' || servicio === 'inflado y herramientas';
  }
  return true;
}

export function buildGoogleMapsViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildGoogleMapsMultiPointRouteUrl(points: ServicePoint[]): string | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return buildGoogleMapsViewUrl(points[0].latitud, points[0].longitud);
  }
  const limited = points.slice(0, 10);
  const origin = `${limited[0].latitud},${limited[0].longitud}`;
  const destination = `${limited[limited.length - 1].latitud},${limited[limited.length - 1].longitud}`;
  const waypoints = limited
    .slice(1, -1)
    .map((p) => `${p.latitud},${p.longitud}`)
    .join('|');
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'bicycling',
  });
  if (waypoints) {
    params.set('waypoints', waypoints);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildGoogleMyMapsKml(points: ServicePoint[]): string {
  const placemarks = points
    .map(
      (p) => `    <Placemark>
      <name>${escapeXml(p.nombre_punto)}</name>
      <description>${escapeXml(
        `Servicio: ${SERVICE_LABELS[p.servicio]}\nHorario: ${p.horario}\nReferencia: ${p.referencia_puesto}\nCoordenadas: ${p.latitud}, ${p.longitud}`
      )}</description>
      <Point>
        <coordinates>${p.longitud},${p.latitud},0</coordinates>
      </Point>
    </Placemark>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>BiciPosta - Puntos de Inflado y Herramientas</name>
    <description>Puntos exportados para visualizar o importar en Google My Maps y Google Earth.</description>
${placemarks}
  </Document>
</kml>`;
}
