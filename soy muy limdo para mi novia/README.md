# BiciPosta — Puntos de Inflado y Herramientas

Servicio web full-stack (Express + React + TypeScript) preparado para conectar **GitHub**, **Render** y **Supabase**, con mapa interactivo en **OpenStreetMap** (Leaflet) y opciones directas para abrir y exportar ubicaciones a **Google Maps**.

## Funcionalidades principales

- **CRUD completo** de puestos de servicio (`nombre_punto`, `latitud`, `longitud`, `servicio`, `horario`, `referencia_puesto`).
- **Validación estricta de coordenadas** en grados decimales (`-90 <= latitud <= 90` y `-180 <= longitud <= 180`), tanto en el navegador como en el servidor.
- **Filtrado por servicio**: `Todos`, `Inflado` y `Herramientas` (incluyendo puestos con servicio combinado).
- **Mapa OpenStreetMap** con selección bidireccional (lista <-> marcador), popup informativo y modo de captura de coordenadas haciendo clic sobre el mapa.
- **Puente a Google Maps**:
  - Abrir cualquier punto en Google Maps (`Ver en Google Maps` / `Cómo llegar`).
  - Generar una ruta multipunto en Google Maps con los puestos visibles.
  - Exportar un archivo `.kml` estándar para importar en Google My Maps.

## 1. Configurar la tabla en Supabase

1. Creá un proyecto en [Supabase](https://supabase.com).
2. Abrí **SQL Editor** y ejecutá el contenido completo de `supabase/schema.sql`.
   Esto crea la tabla `public.puntos_servicio` con restricciones `CHECK` para latitud/longitud y carga 3 ejemplos en ubicaciones distintas.
3. En **Project Settings -> API**, copiá:
   - `Project URL` (`SUPABASE_URL`)
   - `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`)

## 2. Subir a GitHub

```bash
git init
git add .
git commit -m "Servicio web BiciPosta con Supabase, Render y OpenStreetMap"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## 3. Desplegar en Render

1. En [Render](https://render.com), elegí **New -> Blueprint** (para usar `render.yaml`) o **New -> Web Service** conectado a tu repositorio de GitHub.
2. Configuración del servicio:
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm start`
3. Agregá las variables de entorno en Render:
   - `NODE_ENV`: `production`
   - `SUPABASE_URL`: tu URL de Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: tu clave `service_role` de Supabase
4. Guardá y desplegá. Podés comprobar la conexión en `/api/health`.
