import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../db.js';
import { getCurrentKstDateTime, readSignedCookie, OFFICIAL_RECORD_MODES } from '../config.js';
import {
  officialRecordsSavedTotal,
  recordsCacheEntries,
  recordsCacheRequestsTotal,
} from '../metrics.js';

interface RecordsCacheEntry {
  expiresAt: number;
  records: RowDataPacket[];
}

const recordsCache = new Map<string, RecordsCacheEntry>();
const RECORDS_CACHE_MAX_ENTRIES = 100;
const RANKING_CACHE_TTL_MS = 60 * 1000;
const LATEST_CACHE_TTL_MS = 15 * 1000;

export function clearRecordsCache(): void {
  recordsCache.clear();
  recordsCacheEntries.set(0);
}

function getRecordsCacheKey(options: {
  user?: string;
  hand?: string;
  mode?: string;
  limit: number;
  sort: 'latest' | 'ranking';
}): string {
  return JSON.stringify({
    user: options.user || '',
    hand: options.hand || '',
    mode: options.mode || '',
    limit: options.limit,
    sort: options.sort,
  });
}

function getCachedRecords(key: string): RowDataPacket[] | null {
  const cached = recordsCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    recordsCache.delete(key);
    return null;
  }
  return cached.records;
}

function setCachedRecords(key: string, records: RowDataPacket[], ttlMs: number): void {
  if (recordsCache.size >= RECORDS_CACHE_MAX_ENTRIES) {
    const oldestKey = recordsCache.keys().next().value;
    if (oldestKey) recordsCache.delete(oldestKey);
  }
  recordsCache.set(key, { records, expiresAt: Date.now() + ttlMs });
}

const refreshCooldownMap = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 2000;
const MAX_COOLDOWN_ENTRIES = 10000;

function checkAndSetRefreshCooldown(ip: string, now: number): boolean {
  const last = refreshCooldownMap.get(ip) || 0;
  if (now - last < REFRESH_COOLDOWN_MS) {
    return false;
  }
  if (refreshCooldownMap.size >= MAX_COOLDOWN_ENTRIES) {
    const oldest = refreshCooldownMap.keys().next().value;
    if (oldest) refreshCooldownMap.delete(oldest);
  }
  refreshCooldownMap.set(ip, now);
  return true;
}

const refreshCooldownHook = async (request: FastifyRequest, reply: FastifyReply) => {
  const { refresh } = (request.query || {}) as { refresh?: boolean };
  if (!refresh) return;

  const clientIp = request.ip;
  const now = request.receivedAt || Date.now();

  if (!checkAndSetRefreshCooldown(clientIp, now)) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: '새로고침은 2초마다 1회만 가능합니다.',
    });
  }
};

interface SaveRecordBody {
  hand: 'LEFT' | 'RIGHT';
  mode: string;
  kpm: number;
  accuracy: number;
  totalKeys: number;
  correctKeys: number;
  wrongKeys: number;
  durationSeconds: number;
  mistakes?: Array<{ targetKey: string; pressedKey: string; count: number }>;
}

export const recordsRoutes: FastifyPluginAsync = async (app) => {
  // 유저 목록 조회 (기록이 있는 유저의 닉네임)
  app.get('/api/users', async (_request, reply) => {
    try {
      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT u.nickname AS user_name FROM records r JOIN users u ON r.user_id = u.id ORDER BY u.nickname ASC'
      );
      return rows.map((r) => r.user_name);
    } catch (err) {
      app.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch users' });
    }
  });

  // 기록 조회 (유저별, 모드별, 손별, 정렬별)
  app.get('/api/records', {
    preHandler: [refreshCooldownHook],
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: {
      querystring: {
        type: 'object',
        properties: {
          user: { type: 'string', maxLength: 50 },
          hand: { type: 'string', enum: ['LEFT', 'RIGHT'] },
          mode: { type: 'string', maxLength: 50 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sort: { type: 'string', enum: ['latest', 'ranking'], default: 'latest' },
          refresh: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const { user, hand, mode, limit = 20, sort = 'latest', refresh = false } = request.query as {
      user?: string;
      hand?: string;
      mode?: string;
      limit?: number;
      sort?: 'latest' | 'ranking';
      refresh?: boolean;
    };

    try {
      const cacheKey = getRecordsCacheKey({ user, hand, mode, limit, sort });
      if (!refresh) {
        const cached = getCachedRecords(cacheKey);
        if (cached) {
          recordsCacheRequestsTotal.inc({ result: 'hit' });
          reply.header('X-Records-Cache', 'HIT');
          return cached;
        }
      }
      recordsCacheRequestsTotal.inc({ result: refresh ? 'refresh' : 'miss' });

      const pool = getPool();
      const filters: string[] = [];
      const params: (string | number)[] = [];

      if (user) {
        filters.push('u.nickname = ?');
        params.push(user);
      }
      if (hand) {
        filters.push('r.hand = ?');
        params.push(hand);
      }
      if (mode) {
        filters.push('r.mode = ?');
        params.push(mode);
      }

      if (sort === 'ranking') {
        // 주간 랭킹 기준: 정확도 90% 이상 & 최근 일주일(7일) 집계
        filters.push('r.accuracy >= 90');
        const sevenDaysAgoKst = new Date(Date.now() + 9 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .replace('T', ' ')
          .substring(0, 19);
        filters.push('r.created_at >= ?');
        params.push(sevenDaysAgoKst);
      }

      const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
      let query: string;
      if (sort === 'ranking') {
        // 사용자마다 해당 조건의 최고 기록 한 건만 순위에 포함 (user_id 기준 랭킹 계산 후 users 조인)
        query = `
          SELECT ranked.id, ranked.user_id, u.nickname AS user_name, ranked.hand, ranked.mode,
                 ranked.kpm, ranked.accuracy, ranked.total_keys, ranked.correct_keys,
                 ranked.wrong_keys, ranked.duration_seconds, ranked.created_at
          FROM (
            SELECT r.*,
                   ROW_NUMBER() OVER (
                     PARTITION BY r.user_id
                     ORDER BY r.kpm DESC, r.accuracy DESC, r.created_at DESC
                   ) AS user_best_rank
            FROM records r
            JOIN users u ON r.user_id = u.id
            ${whereClause}
          ) AS ranked
          JOIN users u ON ranked.user_id = u.id
          WHERE ranked.user_best_rank = 1
          ORDER BY ranked.kpm DESC, ranked.accuracy DESC, ranked.created_at DESC
          LIMIT ?`;
      } else {
        query = `
          SELECT r.id, r.user_id, u.nickname AS user_name, r.hand, r.mode,
                 r.kpm, r.accuracy, r.total_keys, r.correct_keys,
                 r.wrong_keys, r.duration_seconds, r.created_at
          FROM records r
          JOIN users u ON r.user_id = u.id
          ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT ?`;
      }
      params.push(limit);

      const [records] = await pool.query<RowDataPacket[]>(query, params);
      setCachedRecords(
        cacheKey,
        records,
        sort === 'ranking' ? RANKING_CACHE_TTL_MS : LATEST_CACHE_TTL_MS
      );
      recordsCacheEntries.set(recordsCache.size);
      reply.header('X-Records-Cache', 'MISS');
      return records;
    } catch (err) {
      app.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch records' });
    }
  });

  // 공식 기록 저장
  app.post('/api/records', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['hand', 'mode', 'kpm', 'accuracy', 'totalKeys', 'correctKeys', 'wrongKeys', 'durationSeconds'],
        properties: {
          hand: { type: 'string', enum: ['LEFT', 'RIGHT'] },
          mode: { type: 'string', enum: OFFICIAL_RECORD_MODES },
          kpm: { type: 'integer', minimum: 0, maximum: 3000 },
          accuracy: { type: 'number', minimum: 0, maximum: 100 },
          totalKeys: { type: 'integer', minimum: 1, maximum: 10000 },
          correctKeys: { type: 'integer', minimum: 0, maximum: 10000 },
          wrongKeys: { type: 'integer', minimum: 0, maximum: 10000 },
          durationSeconds: { type: 'integer', minimum: 1, maximum: 86400 },
          mistakes: {
            type: 'array',
            maxItems: 32,
            items: {
              type: 'object',
              required: ['targetKey', 'pressedKey', 'count'],
              properties: {
                targetKey: { type: 'string', maxLength: 16 },
                pressedKey: { type: 'string', maxLength: 16 },
                count: { type: 'integer', minimum: 1 },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as SaveRecordBody;
    const authenticatedNickname = readSignedCookie(request, 'nummo_user');
    if (!authenticatedNickname) {
      officialRecordsSavedTotal.inc({ result: 'unauthorized', mode: body.mode, hand: body.hand });
      return reply.status(401).send({ error: 'Google login is required' });
    }
    if (body.correctKeys + body.wrongKeys !== body.totalKeys) {
      return reply.status(400).send({ error: 'Invalid keystroke totals' });
    }
    const pool = getPool();
    const conn = await pool.getConnection();
    const nowKST = getCurrentKstDateTime();

    try {
      await conn.beginTransaction();

      const [userRows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE nickname = ? LIMIT 1',
        [authenticatedNickname]
      );
      if (userRows.length === 0) {
        await conn.rollback();
        officialRecordsSavedTotal.inc({ result: 'unauthorized', mode: body.mode, hand: body.hand });
        return reply.status(401).send({ error: 'User account not found' });
      }
      const userId = Number(userRows[0].id);

      const [res] = await conn.query<ResultSetHeader>(
        `INSERT INTO records (user_id, hand, mode, kpm, accuracy, total_keys, correct_keys, wrong_keys, duration_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          body.hand,
          body.mode,
          body.kpm,
          body.accuracy,
          body.totalKeys,
          body.correctKeys,
          body.wrongKeys,
          body.durationSeconds,
          nowKST,
        ]
      );

      const recordId = res.insertId;

      if (body.mistakes && body.mistakes.length > 0) {
        for (const m of body.mistakes) {
          await conn.query(
            `INSERT INTO key_mistakes (record_id, target_key, pressed_key, mistake_count)
             VALUES (?, ?, ?, ?)`,
            [recordId, m.targetKey, m.pressedKey, m.count]
          );
        }
      }

      await conn.commit();
      clearRecordsCache();
      officialRecordsSavedTotal.inc({ result: 'success', mode: body.mode, hand: body.hand });
      return { success: true, recordId };
    } catch (err) {
      await conn.rollback();
      officialRecordsSavedTotal.inc({ result: 'failure', mode: body.mode, hand: body.hand });
      app.log.error(err);
      reply.status(500).send({ error: 'Failed to save record' });
    } finally {
      conn.release();
    }
  });
};
