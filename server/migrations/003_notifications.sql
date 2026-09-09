CREATE TABLE IF NOT EXISTS notifications (
 id CHAR(36) PRIMARY KEY,
 recipient_id CHAR(36) NOT NULL,
 actor_id CHAR(36) NOT NULL,
 topic_id CHAR(36) NOT NULL,
 comment_id CHAR(36) NULL,
 kind ENUM('comment','like') NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 read_at TIMESTAMP(3) NULL,
 FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
 FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
 INDEX notification_feed(recipient_id,created_at,id),
 INDEX notification_unread(recipient_id,read_at)
);
CREATE TRIGGER IF NOT EXISTS notify_forum_comment AFTER INSERT ON forum_comments FOR EACH ROW INSERT INTO notifications(id,recipient_id,actor_id,topic_id,comment_id,kind) SELECT UUID(),t.user_id,NEW.user_id,NEW.topic_id,NEW.id,'comment' FROM forum_topics t WHERE t.id=NEW.topic_id AND t.user_id<>NEW.user_id;
CREATE TRIGGER IF NOT EXISTS notify_forum_like AFTER INSERT ON forum_likes FOR EACH ROW INSERT INTO notifications(id,recipient_id,actor_id,topic_id,kind) SELECT UUID(),t.user_id,NEW.user_id,NEW.topic_id,'like' FROM forum_topics t WHERE t.id=NEW.topic_id AND t.user_id<>NEW.user_id;
CREATE TRIGGER IF NOT EXISTS remove_forum_like_notification AFTER DELETE ON forum_likes FOR EACH ROW DELETE FROM notifications WHERE topic_id=OLD.topic_id AND actor_id=OLD.user_id AND kind='like';
