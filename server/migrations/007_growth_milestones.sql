ALTER TABLE records ADD COLUMN height_position ENUM('recumbent','standing') NULL;
CREATE TABLE IF NOT EXISTS child_milestones (
 child_id CHAR(36) NOT NULL,
 milestone_id VARCHAR(40) NOT NULL,
 observed_date DATE NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(child_id,milestone_id),
 FOREIGN KEY(child_id) REFERENCES children(id) ON DELETE CASCADE
);
