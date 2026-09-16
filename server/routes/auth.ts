import type { FastifyPluginAsync } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { getPool } from '../db.js';
import {
  readSignedCookie,
  signedCookieOptions,
  secureValuesMatch,
} from '../config.js';
import { oauthEventsTotal } from '../metrics.js';
import { clearRecordsCache } from './records.js';

const googleOAuthClient = new OAuth2Client();

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

export const authRoutes: FastifyPluginAsync = async (app) => {
  // 1. Google OAuth 로그인 시작 URL로 302 리디렉션
  app.get('/api/auth/google/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = getOAuthRedirectUri(request);
    oauthEventsTotal.inc({ result: 'started' });
    request.log.info({ event: 'oauth_started', redirectUri }, 'Google OAuth started');

    if (!clientId) {
      reply.status(500).send({ error: 'GOOGLE_CLIENT_ID is not configured' });
      return;
    }

    const state = randomBytes(32).toString('base64url');
    reply.setCookie('nummo_oauth_state', state, {
      ...signedCookieOptions,
      maxAge: 60 * 10,
    });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('prompt', 'select_account');
    authUrl.searchParams.set('state', state);

    return reply.redirect(authUrl.toString());
  });

  // 2. Google OAuth 콜백 처리
  app.get('/api/auth/google/callback', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { code, error, state } = request.query as { code?: string; error?: string; state?: string };
    const redirectUri = getOAuthRedirectUri(request);
    request.log.info(
      { event: 'oauth_callback_received', hasCode: Boolean(code), oauthError: error || null, redirectUri },
      'Google OAuth callback received'
    );

    const expectedState = readSignedCookie(request, 'nummo_oauth_state');
    reply.clearCookie('nummo_oauth_state', { path: '/' });
    if (!state || !expectedState || !secureValuesMatch(state, expectedState)) {
      oauthEventsTotal.inc({ result: 'invalid_state' });
      request.log.warn({ event: 'oauth_invalid_state' }, 'OAuth state validation failed');
      return reply.redirect('/?login_error=invalid_state');
    }

    if (error || !code) {
      oauthEventsTotal.inc({ result: 'cancelled' });
      request.log.warn({ event: 'oauth_cancelled', oauthError: error || 'missing_code' }, 'Google OAuth cancelled');
      return reply.redirect('/?login_error=cancelled');
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const tokenRedirectUri = getOAuthRedirectUri(request);

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: tokenRedirectUri,
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

      let googleId: string | undefined;
      try {
        const ticket = await googleOAuthClient.verifyIdToken({
          idToken: tokenData.id_token,
          audience: clientId,
        });
        googleId = ticket.getPayload()?.sub;
      } catch {
        oauthEventsTotal.inc({ result: 'invalid_id_token' });
        request.log.warn({ event: 'oauth_invalid_id_token' }, 'Google ID token validation failed');
        return reply.redirect('/?login_error=invalid_token');
      }

      if (!googleId) {
        oauthEventsTotal.inc({ result: 'missing_subject' });
        return reply.redirect('/?login_error=no_sub');
      }

      const pool = getPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT nickname FROM users WHERE google_id = ? LIMIT 1',
        [googleId]
      );

      if (rows.length > 0) {
        const nickname = rows[0].nickname;
        reply.setCookie('nummo_user', nickname, {
          ...signedCookieOptions,
          maxAge: 60 * 60 * 24 * 30, // 30일
        });
        oauthEventsTotal.inc({ result: 'success_existing' });
        request.log.info({ event: 'oauth_completed', userType: 'existing' }, 'Google OAuth completed');
        return reply.redirect('/?login=success');
      } else {
        reply.setCookie('nummo_pending_sub', googleId, {
          ...signedCookieOptions,
          maxAge: 60 * 15, // 15분
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
  app.get('/api/auth/check-nickname', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { nickname } = request.query as { nickname?: string };
    const trimmed = (nickname || '').trim();

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
  app.post('/api/auth/register-nickname', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const googleId = readSignedCookie(request, 'nummo_pending_sub');

    if (!googleId) {
      return reply.status(401).send({ error: '구글 로그인 인증 세션이 만료되었습니다. 다시 로그인해주세요.' });
    }

    const { nickname } = (request.body || {}) as { nickname?: string };
    const trimmed = (nickname || '').trim();

    const validRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
    if (!validRegex.test(trimmed)) {
      return reply.status(400).send({ error: '2~12자의 한글, 영문, 숫자만 가능합니다.' });
    }

    try {
      const pool = getPool();

      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT 1 FROM users WHERE nickname = ? LIMIT 1',
        [trimmed]
      );
      if (existing.length > 0) {
        return reply.status(409).send({ error: '이미 사용 중인 닉네임입니다.' });
      }

      await pool.query<ResultSetHeader>(
        'INSERT INTO users (google_id, nickname) VALUES (?, ?)',
        [googleId, trimmed]
      );

      request.log.info({ event: 'nickname_registered' }, 'Nickname registration completed');

      reply.clearCookie('nummo_pending_sub', { path: '/' });
      reply.setCookie('nummo_user', trimmed, {
        ...signedCookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30일
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

  // 5. 로그인 유저 닉네임 변경 API
  app.post('/api/auth/change-nickname', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const currentNickname = readSignedCookie(request, 'nummo_user');
    if (!currentNickname) {
      return reply.status(401).send({ error: '로그인이 필요합니다.' });
    }

    const { nickname } = (request.body || {}) as { nickname?: string };
    const trimmed = (nickname || '').trim();

    const validRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
    if (!validRegex.test(trimmed)) {
      return reply.status(400).send({ error: '2~12자의 한글, 영문, 숫자만 사용 가능합니다.' });
    }

    if (trimmed === currentNickname) {
      return reply.status(400).send({ error: '현재 사용 중인 닉네임과 동일합니다.' });
    }

    try {
      const pool = getPool();

      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT 1 FROM users WHERE nickname = ? LIMIT 1',
        [trimmed]
      );
      if (existing.length > 0) {
        return reply.status(409).send({ error: '이미 사용 중인 닉네임입니다.' });
      }

      const [res] = await pool.query<ResultSetHeader>(
        'UPDATE users SET nickname = ? WHERE nickname = ?',
        [trimmed, currentNickname]
      );

      if (res.affectedRows === 0) {
        return reply.status(404).send({ error: '사용자를 찾을 수 없습니다.' });
      }

      clearRecordsCache();

      reply.setCookie('nummo_user', trimmed, {
        ...signedCookieOptions,
        maxAge: 60 * 60 * 24 * 30, // 30일
      });

      request.log.info(
        { event: 'nickname_changed', from: currentNickname, to: trimmed },
        'User nickname changed successfully'
      );

      return { success: true, nickname: trimmed };
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        return reply.status(409).send({ error: '이미 사용 중인 닉네임입니다.' });
      }
      app.log.error(err);
      reply.status(500).send({ error: '닉네임 변경 중 오류가 발생했습니다.' });
    }
  });

  // 6. 현재 로그인 세션 확인 API
  app.get('/api/auth/me', async (request) => {
    const userCookie = readSignedCookie(request, 'nummo_user');
    const pendingCookie = readSignedCookie(request, 'nummo_pending_sub');

    if (userCookie) {
      return { loggedIn: true, nickname: userCookie, needsNickname: false };
    }

    if (pendingCookie) {
      return { loggedIn: false, nickname: null, needsNickname: true };
    }

    return { loggedIn: false, nickname: null, needsNickname: false };
  });

  // 7. 로그아웃 API
  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('nummo_user', { path: '/' });
    reply.clearCookie('nummo_pending_sub', { path: '/' });
    reply.clearCookie('nummo_oauth_state', { path: '/' });
    return { success: true };
  });
};
