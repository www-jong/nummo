import fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { cookieSecret } from './config.js';
import { registerHttpMetrics, startMetricsServer } from './metrics.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { recordsRoutes } from './routes/records.js';
import { practiceRoutes } from './routes/practice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({
  logger: true,
  trustProxy: ['loopback', 'linklocal', 'uniquelocal'],
  bodyLimit: 64 * 1024,
});

// 0. 요청 수신 시각 전역 바인딩 (단일 요청 내 타임스탬프 일관성 보장)
app.addHook('onRequest', async (request) => {
  request.receivedAt = Date.now();
});

// 1. 보안 및 인프라 미들웨어 등록
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
});

await app.register(rateLimit, {
  max: 600,
  timeWindow: '1 minute',
});

await app.register(fastifyCookie, { secret: cookieSecret });
registerHttpMetrics(app);

// 2. 정적 파일 서빙 (dist/ 서빙)
const distPath = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : __dirname;

await app.register(fastifyStatic, {
  root: distPath,
  prefix: '/',
  setHeaders: (res, pathName) => {
    // 해시가 포함된 번들 자산(/assets/*)은 1년 장기 immutable 캐시 적용 (F5 새로고침 시 304 요청 원천 차단)
    if (pathName.includes('/assets/') || pathName.includes('\\assets\\')) {
      res.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (pathName.endsWith('.html')) {
      // index.html은 새 버전 배포 즉시 감지되도록 must-revalidate 적용
      res.header('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      // 파비콘, manifest 등 정적 리소스는 1일 캐시 적용
      res.header('Cache-Control', 'public, max-age=86400');
    }
  },
});

// 3. 도메인별 라우트 등록
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(recordsRoutes);
await app.register(practiceRoutes);

// 404 핸들러
app.setNotFoundHandler((_request, reply) => {
  reply.status(404).send({ error: 'Not Found' });
});

// 서버 기동
const port = Number(process.env.PORT) || 3001;
const metricsPort = Number(process.env.METRICS_PORT) || 9464;
const host = '0.0.0.0';

startMetricsServer(metricsPort);
app.listen({ port, host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info({ event: 'server_started', address, metricsPort }, 'NUMMO server started');
});
