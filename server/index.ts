import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import fs from 'fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getPool, testConnection } from './db.js';
import {
  databaseQueryDurationSeconds,
  databaseUp,
  officialRecordsSavedTotal,
  oauthEventsTotal,
  practiceSessionsSavedTotal,
  recordsCacheEntries,
  recordsCacheRequestsTotal,
  registerHttpMetrics,
  startMetricsServer,
} from './metrics.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({
  logger: true,
  trustProxy: true, // Nginx Proxy Manager 등 리버스 프록시 지원
});

// 1. 보안 미들웨어 등록
await app.register(helmet, {
  contentSecurityPolicy: false, // Vite 빌드 SPA 인라인 스크립트 허용
});

await app.register(cors, {
  origin: true,
});

await app.register(rateLimit, {
  max: 120,
  timeWindow: '1 minute',
});

await app.register(fastifyCookie);
registerHttpMetrics(app);

// 2. 정적 파일 서빙 (dist/ 서빙)
const distPath = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : __dirname;

app.register(fastifyStatic, {
  root: distPath,
  prefix: '/',
});

// 3. API 라우트

// ----------------------------------------------------
// Google OAuth & Nickname Authentication Routes
// ----------------------------------------------------

// Helper: 리디렉션 URI 결정 (환경변수 최우선, 없으면 요청 호스트 자동 감지)
function getOAuthRedirectUri(request: any): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const proto = request.headers['x-forwarded-proto'] || (request.protocol === 'https' ? 'https' : 'http');
  if (host) {
    return `${proto}://${host}/api/auth/google/callback`;
  }
  return 'http://localhost:3000/api/auth/google/callback';
}

// 1. Google OAuth 로그인 시작 URL로 302 리디렉션
app.get('/api/auth/google/login', async (request, reply) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getOAuthRedirectUri(request);
  oauthEventsTotal.inc({ result: 'started' });
  request.log.info({ event: 'oauth_started', redirectUri }, 'Google OAuth started');

  if (!clientId) {
    reply.status(500).send({ error: 'GOOGLE_CLIENT_ID is not configured' });
    return;
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid');
  authUrl.searchParams.set('prompt', 'select_account');

  return reply.redirect(authUrl.toString());
});

// 2. Google OAuth 콜백 처리
app.get('/api/auth/google/callback', async (request, reply) => {
  const { code, error } = request.query as { code?: string; error?: string };
  const redirectUri = getOAuthRedirectUri(request);
  request.log.info(
    { event: 'oauth_callback_received', hasCode: Boolean(code), oauthError: error || null, redirectUri },
    'Google OAuth callback received'
  );

  if (error || !code) {
    oauthEventsTotal.inc({ result: 'cancelled' });
    request.log.warn({ event: 'oauth_cancelled', oauthError: error || 'missing_code' }, 'Google OAuth cancelled');
    return reply.redirect('/?login_error=cancelled');
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = getOAuthRedirectUri(request);

    // 토큰 교환 요청
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      oauthEventsTotal.inc({ result: 'token_failed' });
      request.log.error({ event: 'oauth_token_failed', statusCode: tokenRes.status }, 'OAuth token exchange failed');
      return reply.redirect('/?login_error=token_failed');
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string };
    if (!tokenData.id_token) {
      oauthEventsTotal.inc({ result: 'missing_id_token' });
      return reply.redirect('/?login_error=no_id_token');
    }

    // id_token payload 디코딩 (sub: 고유 식별자만 추출, 개인정보 일절 배제)
    const tokenParts = tokenData.id_token.split('.');
    if (tokenParts.length < 2) {
      oauthEventsTotal.inc({ result: 'invalid_id_token' });
      return reply.redirect('/?login_error=invalid_token');
    }

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString('utf8')) as { sub?: string };
    const googleId = payload.sub;

    if (!googleId) {
      oauthEventsTotal.inc({ result: 'missing_subject' });
      return reply.redirect('/?login_error=no_sub');
    }

    // DB 조회: 이미 닉네임을 등록한 회원인가?
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT nickname FROM users WHERE google_id = ? LIMIT 1',
      [googleId]
    );

    if (rows.length > 0) {
      // 기존 회원 -> 세션 쿠키 발급 후 메인으로 리디렉트
      const nickname = rows[0].nickname;
      reply.setCookie('nummo_user', nickname, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30일
        httpOnly: false, // 프론트엔드 렌더링용
        sameSite: 'lax',
      });
      oauthEventsTotal.inc({ result: 'success_existing' });
      request.log.info({ event: 'oauth_completed', userType: 'existing' }, 'Google OAuth completed');
      return reply.redirect('/?login=success');
    } else {
      // 신규 회원 -> 임시 세션 쿠키 발급 후 닉네임 설정 모달 유도
      reply.setCookie('nummo_pending_sub', googleId, {
        path: '/',
        maxAge: 60 * 15, // 15분
        httpOnly: true,
        sameSite: 'lax',
      });
      oauthEventsTotal.inc({ result: 'success_new' });
      request.log.info({ event: 'oauth_completed', userType: 'new' }, 'Google OAuth completed');
      return reply.redirect('/?login=needs_nickname');
    }
  } catch (err) {
    oauthEventsTotal.inc({ result: 'internal_error' });
    app.log.error(err);
    return reply.redirect('/?login_error=internal');
  }
});

// 3. 닉네임 중복 체크 API
app.get('/api/auth/check-nickname', async (request, reply) => {
  const { nickname } = request.query as { nickname?: string };
  const trimmed = (nickname || '').trim();

  // 2~12자 한글, 영문, 숫자 허용
  const validRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
  if (!validRegex.test(trimmed)) {
    return {
      available: false,
      message: '2~12자의 한글, 영문, 숫자만 사용 가능합니다.',
    };
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT 1 FROM users WHERE nickname = ? LIMIT 1',
      [trimmed]
    );

    if (rows.length > 0) {
      return { available: false, message: '이미 사용 중인 닉네임입니다.' };
    }
    return { available: true, message: '사용 가능한 닉네임입니다.' };
  } catch (err) {
    app.log.error(err);
    reply.status(500).send({ error: 'DB query failed' });
  }
});

// 4. 신규 유저 닉네임 최종 등록 API
app.post('/api/auth/register-nickname', async (request, reply) => {
  const googleId = request.cookies.nummo_pending_sub;

  if (!googleId) {
    return reply.status(401).send({ error: '구글 로그인 인증 세션이 만료되었습니다. 다시 로그인해주세요.' });
  }

  const { nickname } = (request.body || {}) as { nickname?: string };
  const trimmed = (nickname || '').trim();

  // 유효성 재검증
  const validRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
  if (!validRegex.test(trimmed)) {
    return reply.status(400).send({ error: '2~12자의 한글, 영문, 숫자만 가능합니다.' });
  }

  try {
    const pool = getPool();

    // 중복 체크
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT 1 FROM users WHERE nickname = ? LIMIT 1',
      [trimmed]
    );
    if (existing.length > 0) {
      return reply.status(409).send({ error: '이미 사용 중인 닉네임입니다.' });
    }

    // 신규 등록
    await pool.query<ResultSetHeader>(
      'INSERT INTO users (google_id, nickname) VALUES (?, ?)',
      [googleId, trimmed]
    );

    request.log.info({ event: 'nickname_registered' }, 'Nickname registration completed');

    // 성공 시 임시 쿠키 제거 & 로그인 쿠키 발급
    reply.clearCookie('nummo_pending_sub', { path: '/' });
    reply.setCookie('nummo_user', trimmed, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30일
      httpOnly: false,
      sameSite: 'lax',
    });

    return { success: true, nickname: trimmed };
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return reply.status(409).send({ error: '이미 등록된 계정 또는 닉네임입니다.' });
    }
    app.log.error(err);
    reply.status(500).send({ error: 'Failed to register nickname' });
  }
});

// 5. 현재 로그인 세션 확인 API
app.get('/api/auth/me', async (request) => {
  const userCookie = request.cookies.nummo_user;
  const pendingCookie = request.cookies.nummo_pending_sub;

  if (userCookie) {
    return { loggedIn: true, nickname: userCookie, needsNickname: false };
  }

  if (pendingCookie) {
    return { loggedIn: false, nickname: null, needsNickname: true };
  }

  return { loggedIn: false, nickname: null, needsNickname: false };
});

// 6. 로그아웃 API
app.post('/api/auth/logout', async (_request, reply) => {
  reply.clearCookie('nummo_user', { path: '/' });
  reply.clearCookie('nummo_pending_sub', { path: '/' });
  return { success: true };
});

// 헬스체크 & DB 상태
app.get('/api/health/live', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

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

// 유저 목록 조회
app.get('/api/users', async (_request, reply) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT DISTINCT user_name FROM records ORDER BY user_name ASC'
    );
    return rows.map((r) => r.user_name);
  } catch (err) {
    app.log.error(err);
    reply.status(500).send({ error: 'Failed to fetch users' });
  }
});

interface RecordsCacheEntry {
  expiresAt: number;
  records: RowDataPacket[];
}

const recordsCache = new Map<string, RecordsCacheEntry>();
const RECORDS_CACHE_MAX_ENTRIES = 100;
const RANKING_CACHE_TTL_MS = 60 * 1000;
const LATEST_CACHE_TTL_MS = 15 * 1000;
const PRACTICE_MODES = [
  'CALC_BASIC',
  'CALC_ADVANCED',
  'CALC_MIXED',
  'CALC_RECEIPT',
  'ROW_HOME',
  'ROW_BOTTOM',
  'ROW_TOP',
  'NUM_RANDOM',
] as const;

function getCurrentKstDateTime(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .substring(0, 19);
}

function getAnonymousId(request: any, reply: any): string {
  const existingId = request.cookies.nummo_visitor;
  const visitorId = typeof existingId === 'string' && /^[0-9a-f-]{36}$/i.test(existingId)
    ? existingId
    : randomUUID();

  if (visitorId !== existingId) {
    reply.setCookie('nummo_visitor', visitorId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: 'lax',
      secure: request.protocol === 'https',
    });
  }

  return createHash('sha256').update(visitorId).digest('hex');
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

// 기록 조회 (유저별, 모드별, 손별, 정렬별)
app.get('/api/records', {
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
      filters.push('user_name = ?');
      params.push(user);
    }
    if (hand) {
      filters.push('hand = ?');
      params.push(hand);
    }
    if (mode) {
      filters.push('mode = ?');
      params.push(mode);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    let query: string;
    if (sort === 'ranking') {
      // 사용자마다 해당 조건의 최고 기록 한 건만 순위에 포함
      query = `
        SELECT id, user_name, hand, mode, kpm, accuracy, total_keys,
               correct_keys, wrong_keys, duration_seconds, created_at
        FROM (
          SELECT records.*,
                 ROW_NUMBER() OVER (
                   PARTITION BY user_name
                   ORDER BY kpm DESC, accuracy DESC, created_at DESC
                 ) AS user_best_rank
          FROM records
          ${whereClause}
        ) AS ranked_records
        WHERE user_best_rank = 1
        ORDER BY kpm DESC, accuracy DESC, created_at DESC
        LIMIT ?`;
    } else {
      query = `
        SELECT * FROM records
        ${whereClause}
        ORDER BY created_at DESC
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

// 기록 저장
interface SaveRecordBody {
  userName: string;
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

app.post('/api/practice-sessions', {
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
        totalKeys: { type: 'integer', minimum: 1 },
        correctKeys: { type: 'integer', minimum: 0 },
        wrongKeys: { type: 'integer', minimum: 0 },
        durationSeconds: { type: 'integer', minimum: 1 },
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
  const pool = getPool();
  const conn = await pool.getConnection();
  let actorType: 'authenticated' | 'anonymous' = 'anonymous';

  try {
    await conn.beginTransaction();

    let userId: number | null = null;
    let anonymousId: string | null = null;
    const nickname = request.cookies.nummo_user;
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

app.post('/api/records', {
  schema: {
    body: {
      type: 'object',
      required: ['userName', 'hand', 'mode', 'kpm', 'accuracy', 'totalKeys', 'correctKeys', 'wrongKeys', 'durationSeconds'],
      properties: {
        userName: { type: 'string', minLength: 1, maxLength: 50 },
        hand: { type: 'string', enum: ['LEFT', 'RIGHT'] },
        mode: { type: 'string', minLength: 1, maxLength: 50 },
        kpm: { type: 'integer', minimum: 0, maximum: 3000 },
        accuracy: { type: 'number', minimum: 0, maximum: 100 },
        totalKeys: { type: 'integer', minimum: 1 },
        correctKeys: { type: 'integer', minimum: 0 },
        wrongKeys: { type: 'integer', minimum: 0 },
        durationSeconds: { type: 'integer', minimum: 1 },
        mistakes: {
          type: 'array',
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
  const pool = getPool();
  const conn = await pool.getConnection();

  // 한국 표준시 (KST, UTC+9) 형식 문자열: YYYY-MM-DD HH:mm:ss
  const nowKST = getCurrentKstDateTime();

  try {
    await conn.beginTransaction();

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO records (user_name, hand, mode, kpm, accuracy, total_keys, correct_keys, wrong_keys, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.userName.trim(),
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
    recordsCache.clear();
    recordsCacheEntries.set(0);
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

// SPA fallback: 모든 경로를 index.html로 라우팅
app.setNotFoundHandler((request, reply) => {
  if (request.raw.url && request.raw.url.startsWith('/api')) {
    reply.status(404).send({ error: 'Not Found' });
  } else {
    reply.sendFile('index.html');
  }
});

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
