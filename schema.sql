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
