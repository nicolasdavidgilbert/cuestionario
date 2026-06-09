CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(bucket_key, created_at);
