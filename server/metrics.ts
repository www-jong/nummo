import { createServer, type Server } from 'node:http';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';
import { testConnection } from './db.js';

export const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({ service: 'nummo' });
collectDefaultMetrics({ prefix: 'nummo_', register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: 'nummo_http_requests_total',
  help: 'Total HTTP requests handled by the application',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'nummo_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const httpActiveRequests = new Gauge({
  name: 'nummo_http_active_requests',
  help: 'Current number of active HTTP requests',
  registers: [metricsRegistry],
});

export const databaseUp = new Gauge({
  name: 'nummo_database_up',
  help: 'Whether the application database is reachable',
  registers: [metricsRegistry],
});

export const databaseQueryDurationSeconds = new Histogram({
  name: 'nummo_database_query_duration_seconds',
  help: 'Database operation duration in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [metricsRegistry],
});

export const oauthEventsTotal = new Counter({
  name: 'nummo_oauth_events_total',
  help: 'Google OAuth events by result',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export const recordsCacheRequestsTotal = new Counter({
  name: 'nummo_records_cache_requests_total',
  help: 'Ranking and records cache lookups by result',
  labelNames: ['result'] as const,
  registers: [metricsRegistry],
});

export const recordsCacheEntries = new Gauge({
  name: 'nummo_records_cache_entries',
  help: 'Current number of ranking and records cache entries',
  registers: [metricsRegistry],
});

export const officialRecordsSavedTotal = new Counter({
  name: 'nummo_official_records_saved_total',
  help: 'Official record save attempts by result and category',
  labelNames: ['result', 'mode', 'hand'] as const,
  registers: [metricsRegistry],
});

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();

export function registerHttpMetrics(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    requestStartTimes.set(request, process.hrtime.bigint());
    httpActiveRequests.inc();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartTimes.get(request);
    const route = request.routeOptions.url || 'unmatched';
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };

    httpRequestsTotal.inc(labels);
    if (startedAt) {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      httpRequestDurationSeconds.observe(labels, durationSeconds);
    }
    httpActiveRequests.dec();
    requestStartTimes.delete(request);
  });
}

export function startMetricsServer(port: number): Server {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/metrics') {
      response.writeHead(404).end('Not Found');
      return;
    }

    try {
      const dbCheckTimer = databaseQueryDurationSeconds.startTimer({ operation: 'health_ping' });
      const dbOk = await testConnection();
      dbCheckTimer();
      databaseUp.set(dbOk ? 1 : 0);

      response.writeHead(200, { 'Content-Type': metricsRegistry.contentType });
      response.end(await metricsRegistry.metrics());
    } catch {
      databaseUp.set(0);
      response.writeHead(500).end('Metrics collection failed');
    }
  });

  server.listen(port, '0.0.0.0');
  return server;
}
