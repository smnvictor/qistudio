CREATE TABLE booking (
  id           TEXT PRIMARY KEY,
  date         TEXT NOT NULL,
  time         TEXT NOT NULL,
  service      TEXT NOT NULL,
  client_name  TEXT NOT NULL,
  wechat_id    TEXT NOT NULL,
  note         TEXT,
  status       TEXT NOT NULL,
  client_token TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_slot_taken ON booking(date, time)
  WHERE status IN ('pending','confirmed');

CREATE TABLE slot_exception (
  date   TEXT NOT NULL,
  time   TEXT,
  reason TEXT
);

CREATE TABLE day_schedule (
  date TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  durations TEXT NOT NULL DEFAULT '{}'
);
ALTER TABLE booking ADD COLUMN expired_at TEXT;
ALTER TABLE booking ADD COLUMN expiry_notified_at TEXT;
ALTER TABLE booking ADD COLUMN expiry_claimed_at TEXT;
CREATE INDEX idx_pending_expiry ON booking(julianday(created_at)) WHERE status = 'pending';
