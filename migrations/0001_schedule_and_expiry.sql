CREATE TABLE day_schedule (
  date TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  durations TEXT NOT NULL DEFAULT '{}'
);

ALTER TABLE booking ADD COLUMN expired_at TEXT;
ALTER TABLE booking ADD COLUMN expiry_notified_at TEXT;
ALTER TABLE booking ADD COLUMN expiry_claimed_at TEXT;
CREATE INDEX idx_pending_expiry ON booking(julianday(created_at)) WHERE status = 'pending';

-- Preserve the duration of existing Sunday custom bookings at 16:00.
INSERT INTO day_schedule(date, revision, durations)
SELECT DISTINCT date, 1, '{"16:00":180}' FROM booking
WHERE date >= date('now') AND strftime('%w', date) = '0' AND time = '16:00' AND service = 'full'
AND status IN ('pending','confirmed');
