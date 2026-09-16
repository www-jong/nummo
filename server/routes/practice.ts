import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createHash, randomUUID } from 'node:crypto';
import { getPool } from '../db.js';
import {
  getCurrentKstDateTime,
  readSignedCookie,
  signedCookieOptions,
  PRACTICE_MODES,
} from '../config.js';
import { practiceSessionsSavedTotal } from '../metrics.js';

function getAnonymousId(request: FastifyRequest, reply: any): string {
  const existingId = readSignedCookie(request, 'nummo_visitor');
  const visitorId = typeof existingId === 'string' && /^[0-9a-f-]{36}$/i.test(existingId)
    ? existingId
    : randomUUID();

  if (visitorId !== existingId) {
    reply.setCookie('nummo_visitor', visitorId, {
      ...signedCookieOptions,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return createHash('sha256').update(visitorId).digest('hex');
}

interface SavePracticeSessionBody {
  hand: 'LEFT' | 'RIGHT';
  mode: string;
  inputBehavior: 'CONTINUOUS' | 'STRICT';
  problemCount: number;
  kpm: number;
  accuracy: number;
  totalKeys: number;
  correctKeys: number;
  wrongKeys: number;
  durationSeconds: number;
  mistakes?: Array<{ targetKey: string; pressedKey: string; count: number }>;
}

export const practiceRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/practice-sessions', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: [
          'hand',
          'mode',
          'inputBehavior',
          'problemCount',
          'kpm',
          'accuracy',
          'totalKeys',
          'correctKeys',
          'wrongKeys',
          'durationSeconds',
        ],
        properties: {
          hand: { type: 'string', enum: ['LEFT', 'RIGHT'] },
          mode: { type: 'string', enum: PRACTICE_MODES },
          inputBehavior: { type: 'string', enum: ['CONTINUOUS', 'STRICT'] },
          problemCount: { type: 'integer', minimum: 1, maximum: 100 },
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
    const body = request.body as SavePracticeSessionBody;
    if (body.correctKeys + body.wrongKeys !== body.totalKeys) {
      return reply.status(400).send({ error: 'Invalid keystroke totals' });
    }
    const pool = getPool();
    const conn = await pool.getConnection();
    let actorType: 'authenticated' | 'anonymous' = 'anonymous';

    try {
      await conn.beginTransaction();

      let userId: number | null = null;
      let anonymousId: string | null = null;
      const nickname = readSignedCookie(request, 'nummo_user');
      if (nickname) {
        const [users] = await conn.query<RowDataPacket[]>(
          'SELECT id FROM users WHERE nickname = ? LIMIT 1',
          [nickname]
        );
        if (users.length > 0) {
          userId = Number(users[0].id);
          actorType = 'authenticated';
        }
      }
      if (!userId) anonymousId = getAnonymousId(request, reply);

      const [sessionResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO practice_sessions (
          user_id, anonymous_id, mode, hand, input_behavior, problem_count,
          kpm, accuracy, total_keys, correct_keys, wrong_keys, duration_seconds, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          anonymousId,
          body.mode,
          body.hand,
          body.inputBehavior,
          body.problemCount,
          body.kpm,
          body.accuracy,
          body.totalKeys,
          body.correctKeys,
          body.wrongKeys,
          body.durationSeconds,
          getCurrentKstDateTime(),
        ]
      );

      for (const mistake of body.mistakes || []) {
        await conn.query(
          `INSERT INTO practice_session_mistakes
            (session_id, target_key, pressed_key, mistake_count)
           VALUES (?, ?, ?, ?)`,
          [sessionResult.insertId, mistake.targetKey, mistake.pressedKey, mistake.count]
        );
      }

      await conn.commit();
      practiceSessionsSavedTotal.inc({
        result: 'success',
        actor_type: actorType,
        mode: body.mode,
        hand: body.hand,
      });
      request.log.info(
        { event: 'practice_session_saved', actorType, mode: body.mode, hand: body.hand },
        'Practice session saved'
      );
      return reply.status(201).send({ success: true, sessionId: sessionResult.insertId });
    } catch (err) {
      await conn.rollback();
      practiceSessionsSavedTotal.inc({
        result: 'failure',
        actor_type: actorType,
        mode: body.mode,
        hand: body.hand,
      });
      request.log.error({ err, event: 'practice_session_save_failed' }, 'Failed to save practice session');
      return reply.status(500).send({ error: 'Failed to save practice session' });
    } finally {
      conn.release();
    }
  });

  // 내 연습 기록 및 통계 조회 API
  app.get('/api/practice-sessions/my', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          hand: { type: 'string', enum: ['LEFT', 'RIGHT'] },
          mode: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 10, hand, mode } = (request.query || {}) as {
      page?: number;
      limit?: number;
      hand?: string;
      mode?: string;
    };

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const pool = getPool();
    let userId: number | null = null;
    let anonymousId: string | null = null;

    const nickname = readSignedCookie(request, 'nummo_user');
    if (nickname) {
      const [users] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE nickname = ? LIMIT 1',
        [nickname]
      );
      if (users.length > 0) {
        userId = Number(users[0].id);
      }
    }
    if (!userId) {
      anonymousId = getAnonymousId(request, reply);
    }

    try {
      const condition = userId ? 'ps.user_id = ?' : 'ps.anonymous_id = ?';
      const idParam = userId ?? anonymousId;

      const extraFilters: string[] = [];
      const extraParams: any[] = [];
      if (hand) {
        extraFilters.push('ps.hand = ?');
        extraParams.push(hand);
      }
      if (mode) {
        extraFilters.push('ps.mode = ?');
        extraParams.push(mode);
      }
      const filterClause = extraFilters.length > 0 ? `AND ${extraFilters.join(' AND ')}` : '';

      // 1. 통계 요약 (전체 연습 횟수, 평균 KPM, 최고 KPM, 평균 정확도, 총 타건수)
      const [summaryRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS totalSessions,
                COALESCE(ROUND(AVG(ps.kpm)), 0) AS avgKpm,
                COALESCE(MAX(ps.kpm), 0) AS bestKpm,
                COALESCE(ROUND(AVG(ps.accuracy), 1), 0) AS avgAccuracy,
                COALESCE(SUM(ps.total_keys), 0) AS totalKeys
         FROM practice_sessions ps
         WHERE ${condition} ${filterClause}`,
        [idParam, ...extraParams]
      );

      // 2. 자주 틀리는 키 TOP 3
      const [topMistakes] = await pool.query<RowDataPacket[]>(
        `SELECT psm.target_key AS targetKey, psm.pressed_key AS pressedKey, SUM(psm.mistake_count) AS count
         FROM practice_session_mistakes psm
         JOIN practice_sessions ps ON psm.session_id = ps.id
         WHERE ${condition} ${filterClause}
         GROUP BY psm.target_key, psm.pressed_key
         ORDER BY count DESC
         LIMIT 3`,
        [idParam, ...extraParams]
      );

      // 3. 최근 연습 세션 목록 (페이지네이션 적용)
      const [sessions] = await pool.query<RowDataPacket[]>(
        `SELECT ps.id, ps.mode, ps.hand, ps.input_behavior AS inputBehavior, ps.problem_count AS problemCount,
                ps.kpm, ps.accuracy, ps.total_keys AS totalKeys, ps.correct_keys AS correctKeys,
                ps.wrong_keys AS wrongKeys, ps.duration_seconds AS durationSeconds, ps.created_at AS createdAt
         FROM practice_sessions ps
         WHERE ${condition} ${filterClause}
         ORDER BY ps.created_at DESC
         LIMIT ? OFFSET ?`,
        [idParam, ...extraParams, limitNum, offset]
      );

      // 4. 각 세션별 오타 매핑
      const sessionIds = sessions.map((s) => s.id);
      const mistakesMap: Record<number, Array<{ targetKey: string; pressedKey: string; count: number }>> = {};

      if (sessionIds.length > 0) {
        const [mistakes] = await pool.query<RowDataPacket[]>(
          `SELECT session_id AS sessionId, target_key AS targetKey, pressed_key AS pressedKey, mistake_count AS count
           FROM practice_session_mistakes
           WHERE session_id IN (?)
           ORDER BY mistake_count DESC`,
          [sessionIds]
        );
        for (const m of mistakes) {
          if (!mistakesMap[m.sessionId]) mistakesMap[m.sessionId] = [];
          mistakesMap[m.sessionId].push({
            targetKey: m.targetKey,
            pressedKey: m.pressedKey,
            count: Number(m.count),
          });
        }
      }

      const sessionsWithMistakes = sessions.map((s) => ({
        ...s,
        mistakes: mistakesMap[s.id] || [],
      }));

      const totalCount = Number(summaryRows[0]?.totalSessions || 0);
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasMore = pageNum < totalPages;

      return {
        summary: {
          totalSessions: totalCount,
          avgKpm: Number(summaryRows[0]?.avgKpm || 0),
          bestKpm: Number(summaryRows[0]?.bestKpm || 0),
          avgAccuracy: Number(summaryRows[0]?.avgAccuracy || 0),
          totalKeys: Number(summaryRows[0]?.totalKeys || 0),
          topMistakes: topMistakes.map((m) => ({
            targetKey: m.targetKey,
            pressedKey: m.pressedKey,
            count: Number(m.count),
          })),
        },
        sessions: sessionsWithMistakes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
          hasMore,
        },
      };
    } catch (err) {
      app.log.error(err);
      reply.status(500).send({ error: 'Failed to fetch practice history' });
    }
  });
};
