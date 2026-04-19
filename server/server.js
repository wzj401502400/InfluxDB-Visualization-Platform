// server/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHandler } from 'graphql-http/lib/use/express';

import { generateSchema } from './graphql/schema.js';
import { makeResolvers } from './graphql/resolvers.js';
import { sessionMiddleware, getSession } from './services/session.js';
import { listBuckets, validateInflux } from './services/influx.js';
import restRouter from './routes/rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// If behind a reverse proxy (Nginx/CDN), consider enabling this
// app.set('trust proxy', 1);

app.use(express.json());
sessionMiddleware(app);

// Health check
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.set('etag', false); // Disable ETag

// REST
app.use('/api', restRouter);
app.use('/auth', restRouter);

// GraphQL
const schema = generateSchema();
const rootValue = makeResolvers({ listBuckets, validateInflux });

app.all('/graphql', createHandler({
  schema,
  rootValue,
  context: (req, _params, ctx) => ({
    req: req.raw,
    res: ctx.res,
    getSession: () => getSession(req.raw),
  }),
}));

// Static assets (public)
app.use(express.static(path.join(__dirname, '../public')));

// If using Vite to build frontend and want the backend to serve it:
// app.use(express.static(path.join(__dirname, '../client/dist')));

// 404 fallback (when no static file or API route matched)
app.use((req, res, _next) => {
  // For SPA frontend routing, you can fall back unknown routes to index.html in production
  // return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  res.status(404).json({ ok: false, error: 'Not Found' });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server:   http://localhost:${PORT}`);
  console.log(`✅ GraphQL:  http://localhost:${PORT}/graphql`);
  console.log(`✅ Health:   http://localhost:${PORT}/healthz`);
});

// Optional: export app for integration testing
//export default app;


