// server.js — Express wrapper que sirve el SPA + monta los handlers /api/*
// Necesario porque las funciones en /api/ son serverless-style (Vercel/Netlify)
// y el VPS necesita un proceso Node.js que escuche en un puerto.
import 'dotenv/config';
import express from 'express';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3004;
const HOST = '0.0.0.0';
const API_DIR = path.join(__dirname, 'api');
const DIST_DIR = path.join(__dirname, 'dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Healthcheck
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Cargar dinámicamente cada handler en /api/*.js como ruta /api/<nombre>
const apiFiles = fs.existsSync(API_DIR)
  ? fs.readdirSync(API_DIR).filter(f => f.endsWith('.js') && !/BACKUP|backup/i.test(f))
  : [];

for (const file of apiFiles) {
  const route = '/api/' + file.replace(/\.js$/, '');
  try {
    const mod = await import(pathToFileURL(path.join(API_DIR, file)).href);
    const handler = mod.default;
    if (typeof handler !== 'function') {
      console.warn(`[skip] ${route} — no default export`);
      continue;
    }
    app.all(route, async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        console.error(`[${route}]`, err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
      }
    });
    console.log(`✓ mounted ${route}`);
  } catch (err) {
    console.error(`[load-fail] ${route}:`, err.message);
  }
}

// SPA: estáticos del build de Vite y fallback a index.html para rutas client-side
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
} else {
  console.warn('dist/ no existe — corre "npm run build" antes de start.');
  app.get('*', (_req, res) => res.status(503).send('App no construida (falta dist/).'));
}

app.listen(PORT, HOST, () => {
  console.log(`muestreo-estadistico listo en http://${HOST}:${PORT}`);
});
