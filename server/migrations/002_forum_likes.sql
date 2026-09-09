CREATE TABLE IF NOT EXISTS forum_likes (
 topic_id CHAR(36) NOT NULL,
 user_id CHAR(36) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(topic_id,user_id),
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX likes_user(user_id)
);
