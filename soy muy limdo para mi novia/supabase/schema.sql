-- Esquema SQL para Supabase (PostgreSQL)
-- Ejecutá este script en el SQL Editor de tu proyecto en Supabase.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Índice para filtrar rápido por tipo de servicio
CREATE INDEX IF NOT EXISTS idx_puntos_servicio_tipo ON public.puntos_servicio (servicio);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_puntos_servicio_updated_at ON public.puntos_servicio;
CREATE TRIGGER trg_puntos_servicio_updated_at
  BEFORE UPDATE ON public.puntos_servicio
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Habilitar Row Level Security (RLS)
-- Nota: El servidor Express en Render se conecta usando SUPABASE_SERVICE_ROLE_KEY.
-- Si preferís operar con SUPABASE_ANON_KEY, podés ajustar estas políticas según tu modelo de autenticación.
ALTER TABLE public.puntos_servicio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de puntos" ON public.puntos_servicio;
CREATE POLICY "Lectura publica de puntos"
  ON public.puntos_servicio
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Escritura desde API" ON public.puntos_servicio;
CREATE POLICY "Escritura desde API"
  ON public.puntos_servicio
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Carga inicial de 3 ejemplos en ubicaciones distintas (grados decimales)
INSERT INTO public.puntos_servicio (nombre_punto, latitud, longitud, servicio, horario, referencia_puesto)
SELECT * FROM (
  VALUES
    (
      'Estación Plaza Italia — Inflado Rápido',
      -34.581120,
      -58.420950,
      'inflado',
      '07:00 a 22:00',
      'Tótem verde junto al acceso principal de la bicisenda de Av. Santa Fe'
    ),
    (
      'Puesto Puerto Madero — Taller Urbano',
      -34.608410,
      -58.363890,
      'herramientas',
      '24 horas',
      'Poste metálico con llaves Allen y desmontables frente al Puente de la Mujer'
    ),
    (
      'Posta Parque Centenario — Servicio Integral',
      -34.606480,
      -58.435720,
      'inflado y herramientas',
      '08:00 a 20:00',
      'Sector oeste de la pista aeróbica, a 20 metros del anfiteatro'
    )
) AS seed(nombre_punto, latitud, longitud, servicio, horario, referencia_puesto)
WHERE NOT EXISTS (SELECT 1 FROM public.puntos_servicio LIMIT 1);
