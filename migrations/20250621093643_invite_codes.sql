-- Add migration script here
CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT (datetime('now', 'localtime'))
);
