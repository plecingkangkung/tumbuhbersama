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
CREATE TABLE IF NOT EXISTS forum_topics (
 id CHAR(36) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 title VARCHAR(160) NOT NULL,
 category VARCHAR(40) NOT NULL,
 body TEXT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX topic_date(created_at,id), INDEX topic_category(category,created_at)
);
CREATE TABLE IF NOT EXISTS forum_comments (
 id CHAR(36) PRIMARY KEY,
 topic_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 parent_id CHAR(36) NULL,
 reply_to_user_id CHAR(36) NULL,
 is_reply BOOLEAN NOT NULL DEFAULT FALSE,
 FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE SET NULL,
 FOREIGN KEY(reply_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
 body TEXT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX comment_topic(topic_id,created_at,id)
);
CREATE TABLE IF NOT EXISTS forum_likes (
 topic_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(topic_id,user_id),
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX likes_user(user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
 id CHAR(36) PRIMARY KEY,
 recipient_id CHAR(36) NOT NULL,
 actor_id CHAR(36) NOT NULL,
 topic_id CHAR(36) NOT NULL,
 comment_id CHAR(36) NULL,
 kind ENUM('comment','like','reply') NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 read_at TIMESTAMP(3) NULL,
 FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
 INDEX notification_feed(recipient_id,created_at,id),
 INDEX notification_unread(recipient_id,read_at)
);
CREATE TRIGGER IF NOT EXISTS notify_forum_comment AFTER INSERT ON forum_comments FOR EACH ROW INSERT INTO notifications(id,recipient_id,actor_id,topic_id,comment_id,kind) SELECT UUID(),t.user_id,NEW.user_id,NEW.topic_id,NEW.id,IF(NEW.reply_to_user_id=t.user_id,'reply','comment') FROM forum_topics t WHERE t.id=NEW.topic_id AND t.user_id<>NEW.user_id UNION ALL SELECT UUID(),NEW.reply_to_user_id,NEW.user_id,NEW.topic_id,NEW.id,'reply' FROM forum_topics t WHERE t.id=NEW.topic_id AND NEW.reply_to_user_id IS NOT NULL AND NEW.reply_to_user_id<>NEW.user_id AND NEW.reply_to_user_id<>t.user_id;
CREATE TRIGGER IF NOT EXISTS notify_forum_like AFTER INSERT ON forum_likes FOR EACH ROW INSERT INTO notifications(id,recipient_id,actor_id,topic_id,kind) SELECT UUID(),t.user_id,NEW.user_id,NEW.topic_id,'like' FROM forum_topics t WHERE t.id=NEW.topic_id AND t.user_id<>NEW.user_id;
CREATE TRIGGER IF NOT EXISTS remove_forum_like_notification AFTER DELETE ON forum_likes FOR EACH ROW DELETE FROM notifications WHERE topic_id=OLD.topic_id AND actor_id=OLD.user_id AND kind='like';
CREATE TABLE IF NOT EXISTS forum_media (
 id CHAR(36) PRIMARY KEY,
 topic_id CHAR(36) NOT NULL,
 comment_id CHAR(36) NULL,
 mime VARCHAR(40) NOT NULL,
 size INT UNSIGNED NOT NULL,
 data MEDIUMBLOB NOT NULL,
 INDEX(topic_id,comment_id),
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE
);
