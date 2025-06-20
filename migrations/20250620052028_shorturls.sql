-- Add migration script here
CREATE TABLE IF NOT EXISTS shortlinks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  short TEXT NOT NULL UNIQUE,
  long TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT (datetime('now', 'localtime'))
);
