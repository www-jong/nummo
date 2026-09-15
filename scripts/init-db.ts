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
  console.log('Connecting to MySQL at', process.env.DB_HOST, 'port', process.env.DB_PORT, 'as', process.env.DB_USER);

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
      user_name VARCHAR(50) NOT NULL DEFAULT 'guest',
      hand ENUM('LEFT', 'RIGHT') NOT NULL,
      mode VARCHAR(50) NOT NULL,
      kpm INT NOT NULL,
      accuracy DECIMAL(5, 2) NOT NULL,
      total_keys INT NOT NULL,
      correct_keys INT NOT NULL,
      wrong_keys INT NOT NULL,
      duration_seconds INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_name),
      INDEX idx_mode_created (mode, created_at),
      INDEX idx_hand (hand)
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

  await dbConn.end();
  console.log('Database initialization completed successfully!');
}

initDB().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
