CREATE DATABASE IF NOT EXISTS tumbuh_bersama CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tumbuh_bersama;
CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id CHAR(36) NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX (expires_at)
);
CREATE TABLE IF NOT EXISTS children (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(80) NOT NULL,
 dob DATE NOT NULL, sex ENUM('female','male') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX(user_id)
);
CREATE TABLE IF NOT EXISTS records (
 id CHAR(36) PRIMARY KEY, child_id CHAR(36) NOT NULL,
 kind ENUM('measurement','journal','visit') NOT NULL, date DATE NOT NULL,
 weight DECIMAL(5,2), height DECIMAL(5,1), head DECIMAL(4,1), title VARCHAR(150), category VARCHAR(40), notes TEXT,
 measurement_date DATE GENERATED ALWAYS AS (CASE WHEN kind='measurement' THEN date ELSE NULL END) STORED,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
 UNIQUE KEY one_measurement_per_day(child_id,measurement_date), INDEX(child_id,date)
);
