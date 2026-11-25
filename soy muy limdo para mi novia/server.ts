import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPoint,
  deletePoint,
  isSupabaseConfigured,
  listPoints,
  seedExamplePoints,
  updatePoint,
  validatePointPayload,
} from './src/server/repository.ts';
import type { ServiceFilter } from './src/types/point.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: isSupabaseConfigured() ? 'supabase' : 'local',
    });
  });

  app.get('/api/points', async (req, res) => {
    try {
      const rawFilter = typeof req.query.servicio === 'string' ? req.query.servicio.trim().toLowerCase() : 'todos';
      const filter: ServiceFilter =
        rawFilter === 'inflado' || rawFilter === 'herramientas' ? rawFilter : 'todos';
      const points = await listPoints(filter);
      res.json({ points, storage: isSupabaseConfigured() ? 'supabase' : 'local' });
    } catch (error) {
      console.error('Error al listar puntos:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudieron obtener los puntos de servicio.',
      });
    }
  });

  app.post('/api/points', async (req, res) => {
    const validation = validatePointPayload(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({
        error: validation.errors?.[0] || 'Datos inválidos.',
        errors: validation.errors,
      });
    }

    try {
      const created = await createPoint(validation.data);
      return res.status(201).json({ point: created });
    } catch (error) {
      console.error('Error al crear punto:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo guardar el punto.',
      });
    }
  });

  app.put('/api/points/:id', async (req, res) => {
    const validation = validatePointPayload(req.body);
    if (!validation.valid || !validation.data) {
      return res.status(400).json({
        error: validation.errors?.[0] || 'Datos inválidos.',
        errors: validation.errors,
      });
    }

    try {
      const updated = await updatePoint(req.params.id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: 'Punto no encontrado.' });
      }
      return res.json({ point: updated });
    } catch (error) {
      console.error('Error al actualizar punto:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo actualizar el punto.',
      });
    }
  });

  app.delete('/api/points/:id', async (req, res) => {
    try {
      const deleted = await deletePoint(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Punto no encontrado.' });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error('Error al eliminar punto:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudo eliminar el punto.',
      });
    }
  });

  app.post('/api/points/seed', async (_req, res) => {
    try {
      const points = await seedExamplePoints();
      return res.json({ points });
    } catch (error) {
      console.error('Error al cargar ejemplos:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'No se pudieron cargar los ejemplos.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`BiciPosta server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
