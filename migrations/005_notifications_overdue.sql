ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notified_overdue BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_overdue ON notifications(notified_overdue) WHERE read = FALSE;
