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

// 如果后面会放在反向代理/Nginx/CDN 后面，建议打开
// app.set('trust proxy', 1);

app.use(express.json());
sessionMiddleware(app);

// 健康检查
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.set('etag', false); // 禁止 ETag

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

// 静态资源（public）
app.use(express.static(path.join(__dirname, '../public')));

// 如果将来用 Vite 构建前端并想由后端托管：
// app.use(express.static(path.join(__dirname, '../client/dist')));

// 404 兜底（静态/接口都没命中时）
app.use((req, res, _next) => {
  // 若你要做单页应用前端路由，可在生产时把未知路由回退到 index.html
  // return res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  res.status(404).json({ ok: false, error: 'Not Found' });
});

// 错误处理中间件
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

// 可选：导出 app 以便集成测试
//export default app;


