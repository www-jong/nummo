import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function initDB() {
  console.log('Connecting to MySQL...');

  // 1. 데이터베이스 생성을 위해 DB명 없이 접속
  const rootConn = await mysql.createConnection({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
  });

  const dbName = requireEnv('DB_NAME');
  console.log(`Ensuring database '${dbName}' exists...`);
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await rootConn.end();

  // 2. 해당 DB에 접속하여 테이블 생성
  const dbConn = await mysql.createConnection({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT) || 3306,
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: dbName,
  });

  console.log("Creating table 'users'...");
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      google_id VARCHAR(128) NOT NULL UNIQUE,
      nickname VARCHAR(30) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_nickname (nickname)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating table 'records'...");
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS records (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      hand ENUM('LEFT', 'RIGHT') NOT NULL,
      mode VARCHAR(50) NOT NULL,
      kpm INT NOT NULL,
      accuracy DECIMAL(5, 2) NOT NULL,
      total_keys INT NOT NULL,
      correct_keys INT NOT NULL,
      wrong_keys INT NOT NULL,
      duration_seconds INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_records_user_id (user_id),
      INDEX idx_mode_created (mode, created_at),
      INDEX idx_hand (hand),
      CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating table 'key_mistakes'...");
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS key_mistakes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_id BIGINT NOT NULL,
      target_key VARCHAR(16) NOT NULL,
      pressed_key VARCHAR(16) NOT NULL,
      mistake_count INT DEFAULT 1,
      INDEX idx_record (record_id),
      CONSTRAINT fk_record_mistake FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating table 'practice_sessions'...");
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NULL,
      anonymous_id CHAR(64) NULL,
      mode VARCHAR(50) NOT NULL,
      hand ENUM('LEFT', 'RIGHT') NOT NULL,
      input_behavior ENUM('CONTINUOUS', 'STRICT') NOT NULL,
      problem_count INT NOT NULL,
      kpm INT NOT NULL,
      accuracy DECIMAL(5, 2) NOT NULL,
      total_keys INT NOT NULL,
      correct_keys INT NOT NULL,
      wrong_keys INT NOT NULL,
      duration_seconds INT NOT NULL,
      schema_version SMALLINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      INDEX idx_practice_mode_created (mode, created_at),
      INDEX idx_practice_user_created (user_id, created_at),
      INDEX idx_practice_anonymous_created (anonymous_id, created_at),
      INDEX idx_practice_hand_mode_created (hand, mode, created_at),
      CONSTRAINT fk_practice_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Creating table 'practice_session_mistakes'...");
  await dbConn.query(`
    CREATE TABLE IF NOT EXISTS practice_session_mistakes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT NOT NULL,
      target_key VARCHAR(16) NOT NULL,
      pressed_key VARCHAR(16) NOT NULL,
      mistake_count INT NOT NULL DEFAULT 1,
      INDEX idx_practice_mistake_session (session_id),
      CONSTRAINT fk_practice_mistake_session
        FOREIGN KEY (session_id) REFERENCES practice_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await dbConn.end();
  console.log('Database initialization completed successfully!');
}

initDB().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
