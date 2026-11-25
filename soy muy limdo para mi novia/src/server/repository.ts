import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ServiceFilter, ServicePoint, ServicePointInput, ServiceType } from '../types/point.ts';
import { matchesServiceFilter, validateDecimalCoordinate } from '../types/point.ts';

const VALID_SERVICES: readonly ServiceType[] = [
  'inflado',
  'herramientas',
  'inflado y herramientas',
];

const SEED_POINTS: Omit<ServicePoint, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    nombre_punto: 'Estación Plaza Italia — Inflado Rápido',
    latitud: -34.58112,
    longitud: -58.42095,
    servicio: 'inflado',
    horario: '07:00 a 22:00',
    referencia_puesto: 'Tótem verde junto al acceso principal de la bicisenda de Av. Santa Fe',
  },
  {
    nombre_punto: 'Puesto Puerto Madero — Taller Urbano',
    latitud: -34.60841,
    longitud: -58.36389,
    servicio: 'herramientas',
    horario: '24 horas',
    referencia_puesto: 'Poste metálico con llaves Allen y desmontables frente al Puente de la Mujer',
  },
  {
    nombre_punto: 'Posta Parque Centenario — Servicio Integral',
    latitud: -34.60648,
    longitud: -58.43572,
    servicio: 'inflado y herramientas',
    horario: '08:00 a 20:00',
    referencia_puesto: 'Sector oeste de la pista aeróbica, a 20 metros del anfiteatro',
  },
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_FILE = path.join(DATA_DIR, 'puntos_servicio.json');

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}

function getSupabaseConfig(): { url: string; key: string } {
  const rawUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  if (!rawUrl || !key) {
    throw new Error('Supabase no está configurado en las variables de entorno.');
  }
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('SUPABASE_URL debe usar protocolo http o https.');
  }
  return { url: parsed.origin, key };
}

function supabaseHeaders(key: string, prefer?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) {
    headers.Prefer = prefer;
  }
  return headers;
}

export function validatePointPayload(payload: unknown): {
  valid: boolean;
  data?: ServicePointInput;
  errors?: string[];
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Cuerpo de solicitud inválido.'] };
  }
  const body = payload as Record<string, unknown>;
  const errors: string[] = [];

  const nombre = typeof body.nombre_punto === 'string' ? body.nombre_punto.trim() : '';
  if (!nombre) {
    errors.push('El nombre del punto es obligatorio.');
  } else if (nombre.length > 140) {
    errors.push('El nombre del punto no puede superar los 140 caracteres.');
  }

  const latCheck = validateDecimalCoordinate(body.latitud, -90, 90, 'latitud');
  if (!latCheck.valid && latCheck.error) {
    errors.push(latCheck.error);
  }

  const lngCheck = validateDecimalCoordinate(body.longitud, -180, 180, 'longitud');
  if (!lngCheck.valid && lngCheck.error) {
    errors.push(lngCheck.error);
  }

  const servicio = typeof body.servicio === 'string' ? body.servicio.trim().toLowerCase() : '';
  if (!VALID_SERVICES.includes(servicio as ServiceType)) {
    errors.push('El servicio debe ser "inflado", "herramientas" o "inflado y herramientas".');
  }

  const horario = typeof body.horario === 'string' ? body.horario.trim() : '';
  if (!horario) {
    errors.push('El horario es obligatorio.');
  } else if (horario.length > 140) {
    errors.push('El horario no puede superar los 140 caracteres.');
  }

  const referencia = typeof body.referencia_puesto === 'string' ? body.referencia_puesto.trim() : '';
  if (!referencia) {
    errors.push('La referencia del puesto es obligatoria.');
  } else if (referencia.length > 260) {
    errors.push('La referencia del puesto no puede superar los 260 caracteres.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      nombre_punto: nombre,
      latitud: latCheck.numberValue,
      longitud: lngCheck.numberValue,
      servicio: servicio as ServiceType,
      horario,
      referencia_puesto: referencia,
    },
  };
}

function isValidRecordId(id: string): boolean {
  return /^[0-9a-fA-F-]{8,64}$/.test(id);
}

async function readLocalPoints(): Promise<ServicePoint[]> {
  try {
    const content = await fs.readFile(LOCAL_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Archivo inexistente en el primer arranque: inicializar con los 3 ejemplos
  }
  const now = new Date().toISOString();
  const seeded: ServicePoint[] = SEED_POINTS.map((item) => ({
    id: randomUUID(),
    ...item,
    created_at: now,
    updated_at: now,
  }));
  await writeLocalPoints(seeded);
  return seeded;
}

async function writeLocalPoints(points: ServicePoint[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempPath = `${LOCAL_FILE}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(points, null, 2), 'utf-8');
  await fs.rename(tempPath, LOCAL_FILE);
}

export async function listPoints(filter: ServiceFilter = 'todos'): Promise<ServicePoint[]> {
  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseConfig();
    const endpoint = `${url}/rest/v1/puntos_servicio?select=*&order=created_at.desc`;
    const res = await fetch(endpoint, { headers: supabaseHeaders(key) });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al consultar Supabase (${res.status}): ${text}`);
    }
    const rows = (await res.json()) as ServicePoint[];
    return rows.filter((row) => matchesServiceFilter(row.servicio, filter));
  }

  const all = await readLocalPoints();
  return all
    .filter((row) => matchesServiceFilter(row.servicio, filter))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function createPoint(input: ServicePointInput): Promise<ServicePoint> {
  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseConfig();
    const endpoint = `${url}/rest/v1/puntos_servicio`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: supabaseHeaders(key, 'return=representation'),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al insertar en Supabase (${res.status}): ${text}`);
    }
    const rows = (await res.json()) as ServicePoint[];
    return rows[0];
  }

  const points = await readLocalPoints();
  const now = new Date().toISOString();
  const created: ServicePoint = {
    id: randomUUID(),
    ...input,
    created_at: now,
    updated_at: now,
  };
  points.unshift(created);
  await writeLocalPoints(points);
  return created;
}

export async function updatePoint(id: string, input: ServicePointInput): Promise<ServicePoint | null> {
  if (!isValidRecordId(id)) {
    throw new Error('Identificador de punto inválido.');
  }

  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseConfig();
    const endpoint = `${url}/rest/v1/puntos_servicio?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: supabaseHeaders(key, 'return=representation'),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al actualizar en Supabase (${res.status}): ${text}`);
    }
    const rows = (await res.json()) as ServicePoint[];
    return rows[0] ?? null;
  }

  const points = await readLocalPoints();
  const idx = points.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated: ServicePoint = {
    ...points[idx],
    ...input,
    updated_at: new Date().toISOString(),
  };
  points[idx] = updated;
  await writeLocalPoints(points);
  return updated;
}

export async function deletePoint(id: string): Promise<boolean> {
  if (!isValidRecordId(id)) {
    throw new Error('Identificador de punto inválido.');
  }

  if (isSupabaseConfigured()) {
    const { url, key } = getSupabaseConfig();
    const endpoint = `${url}/rest/v1/puntos_servicio?id=eq.${encodeURIComponent(id)}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: supabaseHeaders(key, 'return=representation'),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al eliminar en Supabase (${res.status}): ${text}`);
    }
    const rows = (await res.json()) as ServicePoint[];
    return rows.length > 0;
  }

  const points = await readLocalPoints();
  const filtered = points.filter((p) => p.id !== id);
  if (filtered.length === points.length) return false;
  await writeLocalPoints(filtered);
  return true;
}

export async function seedExamplePoints(): Promise<ServicePoint[]> {
  if (isSupabaseConfigured()) {
    const existing = await listPoints('todos');
    if (existing.length > 0) {
      return existing;
    }
    const { url, key } = getSupabaseConfig();
    const endpoint = `${url}/rest/v1/puntos_servicio`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: supabaseHeaders(key, 'return=representation'),
      body: JSON.stringify(SEED_POINTS),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al cargar ejemplos en Supabase (${res.status}): ${text}`);
    }
    return (await res.json()) as ServicePoint[];
  }

  const existing = await readLocalPoints();
  if (existing.length > 0) {
    return existing;
  }
  const now = new Date().toISOString();
  const seeded: ServicePoint[] = SEED_POINTS.map((item) => ({
    id: randomUUID(),
    ...item,
    created_at: now,
    updated_at: now,
  }));
  await writeLocalPoints(seeded);
  return seeded;
}
