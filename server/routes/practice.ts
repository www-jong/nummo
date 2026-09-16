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
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
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
};
