FROM node:20-alpine AS builder

WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm ci

# 소스 복사 및 통합 빌드 (클라이언트 Vite + 서버 esbuild)
COPY . .
RUN npm run build

# 실행용 경량 이미지
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV METRICS_PORT=9464

# 프로덕션 런타임 의존성 설치 (mysql2, fastify 플러그인 등)
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 산출물 복사
COPY --from=builder /app/dist ./dist

EXPOSE 3000 9464

CMD ["node", "dist/server.mjs"]
