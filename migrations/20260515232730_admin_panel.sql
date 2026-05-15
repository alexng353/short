ALTER TABLE users ADD COLUMN disabled_at TIMESTAMP;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shortlinks ADD COLUMN updated_at TIMESTAMP;
UPDATE users SET is_admin = true WHERE username = 'admin';
