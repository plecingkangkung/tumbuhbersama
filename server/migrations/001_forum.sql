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
 body TEXT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX comment_topic(topic_id,created_at,id)
);
