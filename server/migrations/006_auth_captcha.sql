CREATE TABLE IF NOT EXISTS auth_captchas (
 id CHAR(36) PRIMARY KEY,
 answer_hash CHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL,
 INDEX(expires_at)
);
