# NUMMO (넘모)

> **넘패드(Numpad) 전문 타건 연습 및 기록 시스템**
> 왼손/오른손 모드 지원, 실무 수식 특화, 극강의 미니멀 집중 UI, Google OAuth 닉네임 기반 랭킹 서비스.

---

## 📌 주요 특징

- **왼손 / 오른손 모드 완벽 지원**: 왼손잡이 및 왼손 넘패드 사용자를 위한 전용 키 배치와 운지 가이드 제공.
- **물리 키 캡처 엔진**: W3C 표준 `event.code` 기반으로 OS(Mac, Windows, Linux) 및 NumLock 상태와 무관하게 100% 정확한 넘패드 물리 입력 캡처.
- **실전 특화 수식 제너레이터**:
  - **소수점 사칙연산 (표준)**: 소수점과 사칙연산이 조합된 복합 계산식 (`15.5*4+250.25-18.5=`)
  - **기본 사칙연산 (스피드)**: 정수 사칙연산 연속 타건 (`450*12-85+240/6=`)
  - **복합 전표**: 큰 숫자와 긴 수식 타건 (`125000*0.1+4500-1200=`)
  - **기초 훈련**: 홈 행(456), 상단 행(789), 하단 행(123), 5자리 무작위 수열 등
- **미니멀 집중 타이핑 뷰**:
  - 설정 후 연습 시작 시 방해 요소를 전면 숨기고 문제창, 정확도, 가상 넘패드만 표시되는 집중 모드.
  - 일시정지(`❚❚`), `ESC`를 통한 빠른 설정 복귀, 오타 교정 모드(`CORRECTION`) vs 실전 모드(`CONTINUOUS`) 지원.
- **공식 기록 측정 및 랭킹**:
  - 표준 규격(20문항 / 30문항) 기반 공식 챌린지.
  - 왼손/오른손 랭킹 분리 및 종목별 최고 KPM 순위(1~3위 메달 뱃지) 실시간 집계.
  - 모든 측정 시간은 한국 표준시(KST, UTC+9) 기준으로 정확히 저장 및 표시.
- **개인정보 제로 Google OAuth 2.0 인증**:
  - 이메일, 실명 등 개인정보는 DB에 일절 저장하지 않음.
  - 구글 고유 식별자(`sub`)만 내부 매핑하며, 중복 체크를 거친 **고유 닉네임**으로만 표시 및 기록 집계.
- **홈서버 단일 컨테이너 아키텍처**:
  - Vite SPA 클라이언트와 Fastify API 백엔드가 포트 `3000` 단일 서버로 통합 빌드되어 배포 용이.

---

## 🛠 기술 스택

| 영역               | 기술                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite 6             |
| **Backend**  | Node.js (ESM), Fastify 5, MySQL2, esbuild                            |
| **보안**     | @fastify/helmet, @fastify/rate-limit, @fastify/cookie, @fastify/cors |
| **Database** | MySQL 8.0 (InnoDB, utf8mb4)                                          |

---

## 🗄 데이터베이스 구조

- **`users`**: 구글 고유 식별자 및 유일한 닉네임 관리 (개인정보 미포함)
  - `id`, `google_id` (UNIQUE), `nickname` (UNIQUE), `created_at`
- **`records`**: 타건 세션 측정 데이터
  - `id`, `user_name`, `hand` (LEFT/RIGHT), `mode`, `kpm`, `accuracy`, `total_keys`, `correct_keys`, `wrong_keys`, `duration_seconds`, `created_at`
- **`key_mistakes`**: 오타 빈도 분석 테이블
  - `id`, `record_id`, `target_key`, `pressed_key`, `mistake_count`

---

## 🚀 설치 및 실행 방법

### 1. 환경변수 설정 (`.env`)

프로젝트 루트의 `.env.example`을 복사하여 `.env`를 생성하고 데이터베이스 및 구글 OAuth 정보를 입력합니다.

```bash
cp .env.example .env
```

```env
# Database Configuration (MySQL 8.0)
DB_HOST=your_database_host
DB_PORT=3306
DB_USER=your_database_user
DB_PASSWORD=your_password
DB_NAME=nummo

# Server Settings
PORT=3000

# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

> **구글 클라우드 콘솔 설정**:
>
> - 승인된 리디렉션 URI: `http://localhost:3000/api/auth/google/callback` (외부 접속 시 해당 IP/도메인 URI도 등록)
> - 승인된 자바스크립트 원본: `http://localhost:3000`

### 2. 패키지 설치

```bash
npm install
```

### 3. 데이터베이스 테이블 초기화

```bash
npm run db:init
```

### 4. 개발 서버 실행

```bash
# 클라이언트 개발 서버
npm run dev

# 서버 개발 서버 (API)
npm run dev:server
```

### 5. 프로덕션 빌드 및 실행 (단일 서버)

```bash
# 클라이언트 & 서버 통합 빌드
npm run build

# 단일 프로덕션 서버 실행 (포트 3000)
npm start
```

---

## 🔒 보안 아키텍처

1. **SQL Injection 차단**: 모든 DB 쿼리에 파라미터화된 쿼리(`?` Prepared Statement) 적용.
2. **XSS 방어**: 닉네임 입력 시 특수문자 차단 정규식(`/^[a-zA-Z0-9가-힣]{2,12}$/`) 적용.
3. **DoS 방어**: IP당 1분 120회 요청 제한(`@fastify/rate-limit`).
4. **HTTP 보안 헤더**: `@fastify/helmet` 기반 `X-Frame-Options`, `X-Content-Type-Options` 적용.
5. **안전한 세션 쿠키**: `httpOnly`, `sameSite: 'lax'` 플래그 적용.
6. **외부 IP 대응**: 접속 호스트 헤더 기반 OAuth 리디렉션 자동 매칭.

---

## 📄 라이선스

Private Project. All rights reserved.
