CREATE TABLE IF NOT EXISTS calendar_events (
 id CHAR(36) PRIMARY KEY,
 child_id CHAR(36) NOT NULL,
 vaccine_key VARCHAR(40) NULL,
 source_record_id CHAR(36) NULL,
 kind ENUM('vaccine','doctor') NOT NULL,
 title VARCHAR(160) NOT NULL,
 due_date DATE NOT NULL,
 due_time TIME NULL,
 window_start DATE NULL,
 window_end DATE NULL,
 location VARCHAR(160) NOT NULL DEFAULT '',
 doctor VARCHAR(120) NOT NULL DEFAULT '',
 notes TEXT,
 status ENUM('planned','done','cancelled') NOT NULL DEFAULT 'planned',
 completed_date DATE NULL,
 reminder_days TINYINT NULL DEFAULT 1,
 created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE(child_id,vaccine_key), UNIQUE(source_record_id), INDEX(child_id,due_date), INDEX(status,due_date),
 FOREIGN KEY(child_id) REFERENCES children(id) ON DELETE CASCADE,
 FOREIGN KEY(source_record_id) REFERENCES records(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS calendar_seeded (
 child_id CHAR(36) PRIMARY KEY,
 FOREIGN KEY(child_id) REFERENCES children(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS calendar_reminders (
 id CHAR(36) PRIMARY KEY,
 event_id CHAR(36) NOT NULL,
 phase ENUM('advance','today') NOT NULL,
 created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
 read_at TIMESTAMP(3) NULL,
 UNIQUE(event_id,phase),
 FOREIGN KEY(event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);
