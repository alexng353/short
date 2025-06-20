-- Add migration script here
CREATE TABLE IF NOT EXISTS shortlinks (
  id INTEGER PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  short TEXT NOT NULL UNIQUE,
  long TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT (datetime('now', 'localtime'))
);
