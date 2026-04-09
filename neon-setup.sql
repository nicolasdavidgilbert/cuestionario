-- Neon Database Setup
-- Run this SQL in your Neon dashboard (console.neon.tech)

CREATE TABLE IF NOT EXISTS user_quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  grado TEXT NOT NULL,
  course_id TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quizzes_grado ON user_quizzes(grado);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_created ON user_quizzes(created_at DESC);
