CREATE TABLE IF NOT EXISTS quiz_reports (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES user_quizzes(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_quizzes ADD COLUMN IF NOT EXISTS quiz_hash TEXT;
ALTER TABLE user_quizzes ADD COLUMN IF NOT EXISTS owner_token TEXT DEFAULT '';
ALTER TABLE user_quizzes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_user_quizzes_search ON user_quizzes(grado, course_id, unidad);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_deleted ON user_quizzes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_quiz_reports_quiz_id ON quiz_reports(quiz_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quizzes_hash_active ON user_quizzes(quiz_hash) WHERE deleted_at IS NULL AND quiz_hash IS NOT NULL;
