-- Restricciones que dependen de los datos existentes.
-- Ejecutar solo cuando scripts/inspect-db.mjs no muestre:
--   · rutas con más de un cuestionario activo
--   · estados de reportes fuera de la lista
-- Si fallan, no se ha modificado nada: corrige los datos desde el panel y vuelve a ejecutar.

-- Un único cuestionario activo por ruta pública: evita colisiones aunque dos guardados coincidan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quizzes_route_active
  ON user_quizzes (grado, course_id, (COALESCE(NULLIF(unidad, ''), course_id)))
  WHERE deleted_at IS NULL;

ALTER TABLE quiz_reports DROP CONSTRAINT IF EXISTS quiz_reports_status_check;
ALTER TABLE quiz_reports ADD CONSTRAINT quiz_reports_status_check
  CHECK (status IN ('pendiente', 'en_revision', 'resuelta', 'descartada'));
ALTER TABLE quiz_reports ALTER COLUMN status SET NOT NULL
