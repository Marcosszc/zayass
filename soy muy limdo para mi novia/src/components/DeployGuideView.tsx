import { useState } from 'react';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import type { ServicePoint } from '../types/point.ts';
import { buildGoogleMapsMultiPointRouteUrl, buildGoogleMyMapsKml } from '../types/point.ts';

interface DeployGuideViewProps {
  points: ServicePoint[];
  storageMode: 'supabase' | 'local';
}

const SUPABASE_SQL_SNIPPET = `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.puntos_servicio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_punto text NOT NULL CHECK (char_length(trim(nombre_punto)) > 0),
  latitud double precision NOT NULL CHECK (latitud >= -90 AND latitud <= 90),
  longitud double precision NOT NULL CHECK (longitud >= -180 AND longitud <= 180),
  servicio text NOT NULL CHECK (servicio IN ('inflado', 'herramientas', 'inflado y herramientas')),
  horario text NOT NULL CHECK (char_length(trim(horario)) > 0),
  referencia_puesto text NOT NULL CHECK (char_length(trim(referencia_puesto)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.puntos_servicio (nombre_punto, latitud, longitud, servicio, horario, referencia_puesto)
VALUES
  ('Estación Plaza Italia — Inflado Rápido', -34.581120, -58.420950, 'inflado', '07:00 a 22:00', 'Tótem verde junto al acceso principal de la bicisenda de Av. Santa Fe'),
  ('Puesto Puerto Madero — Taller Urbano', -34.608410, -58.363890, 'herramientas', '24 horas', 'Poste metálico con llaves Allen y desmontables frente al Puente de la Mujer'),
  ('Posta Parque Centenario — Servicio Integral', -34.606480, -58.435720, 'inflado y herramientas', '08:00 a 20:00', 'Sector oeste de la pista aeróbica, a 20 metros del anfiteatro');`;

const RENDER_YAML_SNIPPET = `services:
  - type: web
    name: biciposta-web-service
    runtime: node
    plan: free
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false`;

export function DeployGuideView({ points, storageMode }: DeployGuideViewProps) {
  const [copiedBlock, setCopiedBlock] = useState<'sql' | 'render' | null>(null);

  async function handleCopy(text: string, block: 'sql' | 'render') {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(block);
      setTimeout(() => setCopiedBlock(null), 2000);
    } catch {
      // Fallback silencioso si el navegador bloquea el portapapeles
    }
  }

  function handleDownloadKml() {
    const kml = buildGoogleMyMapsKml(points);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'biciposta-puntos-google-maps.kml';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const routeUrl = buildGoogleMapsMultiPointRouteUrl(points);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Conexión Supabase, GitHub y Render
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Este servicio web ya incluye el servidor Express, los archivos de configuración y la capa de persistencia lista para conectarse con Supabase al desplegar desde GitHub en Render.
            </p>
          </div>
          <div className="text-xs text-slate-600 shrink-0">
            Modo activo en este entorno:{' '}
            <span className="font-semibold text-slate-900">
              {storageMode === 'supabase' ? 'Supabase REST API' : 'Almacenamiento local (sin variables Supabase)'}
            </span>
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                01. Crear tabla y ejemplos en Supabase
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Ejecutá este script en el SQL Editor de tu proyecto Supabase (el archivo completo también está en <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">supabase/schema.sql</code>).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(SUPABASE_SQL_SNIPPET, 'sql')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {copiedBlock === 'sql' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-700" />
                  SQL copiado
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar SQL
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{SUPABASE_SQL_SNIPPET}</code>
          </pre>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              02. Subir el código a GitHub
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Subí este repositorio completo a GitHub. Las claves privadas nunca se guardan en el código: solo se declara la plantilla en <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">.env.example</code>.
            </p>
            <div className="p-4 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
              <div>git init</div>
              <div>git add .</div>
              <div>git commit -m &quot;Servicio web BiciPosta&quot;</div>
              <div>git branch -M main</div>
              <div>git push -u origin main</div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                03. Conectar GitHub con Render
              </h2>
              <button
                type="button"
                onClick={() => handleCopy(RENDER_YAML_SNIPPET, 'render')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedBlock === 'render' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal-700" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar render.yaml
                  </>
                )}
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              En Render elegí <strong>New Blueprint</strong> o <strong>New Web Service</strong> vinculado a tu repo y cargá en <strong>Environment Variables</strong>:
            </p>
            <ul className="text-xs font-mono text-slate-700 space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <li>SUPABASE_URL=https://tu-proyecto.supabase.co</li>
              <li>SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servicio</li>
              <li>NODE_ENV=production</li>
            </ul>
          </section>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Pasar ubicaciones de OpenStreetMap a Google Maps
            </h2>
            <p className="text-sm text-slate-600">
              Podés exportar todos los puestos actuales ({points.length}) en formato KML para importarlos en Google My Maps, o abrir la ruta completa en Google Maps.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadKml}
              disabled={points.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar KML para Google My Maps
            </button>
            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir ruta en Google Maps
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
