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
