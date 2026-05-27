-- D1 database schema for server-side sync storage

CREATE TABLE IF NOT EXISTS calculations (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  manufacturer TEXT NOT NULL,
  part_number TEXT NOT NULL,
  purchase_url TEXT,
  notes TEXT,
  units TEXT NOT NULL,
  d REAL NOT NULL,
  D REAL NOT NULL,
  n REAL NOT NULL,
  Davg REAL NOT NULL,
  k REAL NOT NULL
);

-- Index for querying by updated_at for sync operations
CREATE INDEX IF NOT EXISTS idx_calculations_updated_at ON calculations(updated_at);

-- Index for querying by deleted_at for tombstone filtering
CREATE INDEX IF NOT EXISTS idx_calculations_deleted_at ON calculations(deleted_at);
