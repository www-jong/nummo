import type { FastifyPluginAsync } from 'fastify';
import { testConnection } from '../db.js';
import { databaseQueryDurationSeconds, databaseUp } from '../metrics.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // 라이브니스 체크
  app.get('/api/health/live', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 레디니스 체크 (DB 연결 상태 확인)
  app.get('/api/health/ready', async (request, reply) => {
    const dbCheckTimer = databaseQueryDurationSeconds.startTimer({ operation: 'health_ping' });
    const dbOk = await testConnection();
    dbCheckTimer();
    databaseUp.set(dbOk ? 1 : 0);
    if (!dbOk) {
      request.log.warn({ event: 'database_unavailable' }, 'Readiness check failed');
      reply.status(503);
    }
    return {
      status: dbOk ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'disconnected',
    };
  });

  // 기본 헬스체크
  app.get('/api/health', async () => {
    const dbCheckTimer = databaseQueryDurationSeconds.startTimer({ operation: 'health_ping' });
    const dbOk = await testConnection();
    dbCheckTimer();
    databaseUp.set(dbOk ? 1 : 0);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'disconnected',
    };
  });
};
