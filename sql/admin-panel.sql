-- Panel de administración: catálogo, sesiones, incidencias y control de versiones.
-- Migración aditiva e idempotente: no borra ni fusiona contenido.
-- Las restricciones que dependen de datos existentes están en sql/admin-panel-constraints.sql
-- y se aplican después de revisar el informe de scripts/inspect-db.mjs.

-- Catálogo -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catalog_grades (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_subjects (
  grade_id TEXT NOT NULL REFERENCES catalog_grades(id) ON UPDATE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (grade_id, id)
);

CREATE TABLE IF NOT EXISTS catalog_topics (
  grade_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (grade_id, subject_id, id),
  FOREIGN KEY (grade_id, subject_id) REFERENCES catalog_subjects(grade_id, id) ON UPDATE CASCADE
);

-- Sesiones de administración (solo se guarda el hash del token) --------------

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Control de versiones de los cuestionarios ---------------------------------

ALTER TABLE user_quizzes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Incidencias: reportes públicos + fallos generales sin cuestionario ----------

ALTER TABLE quiz_reports ALTER COLUMN quiz_id DROP NOT NULL;
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'contenido'
  CHECK (kind IN ('contenido', 'error', 'mejora', 'otro'));
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('baja', 'normal', 'alta', 'urgente'));
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quiz_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quiz_reports ALTER COLUMN status SET DEFAULT 'pendiente';

UPDATE quiz_reports SET status = 'pendiente' WHERE status = 'open' OR status IS NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_reports_status ON quiz_reports(status, created_at DESC);

-- Auditoría estructurada ------------------------------------------------------

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT NOT NULL DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'public';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);

-- Población del catálogo -------------------------------------------------------
-- Nombres conocidos (antes en src/lib/curriculum.ts). Solo se insertan si no existen,
-- así que volver a ejecutar la migración nunca pisa nombres editados en el panel.

INSERT INTO catalog_grades (id, name, short, description, sort_order) VALUES
  ('1asir', '1.º de ASIR', 'Primer curso de Administración de Sistemas Informáticos en Red',
   'Primer curso del ciclo formativo de grado superior en Administración de Sistemas Informáticos en Red (ASIR). Reúne los fundamentos del ciclo: hardware y centros de datos, sistemas operativos, redes de ordenadores, bases de datos y digitalización. Los cuestionarios están pensados para repasar cada tema antes de un examen y detectar qué conceptos fallan.', 10),
  ('2asir', '2.º de ASIR', 'Segundo curso de Administración de Sistemas Informáticos en Red',
   'Segundo curso del ciclo de grado superior en Administración de Sistemas Informáticos en Red (ASIR). Se centra en la administración práctica: acceso remoto y gestión de servidores, sistemas gestores de bases de datos y servicios de red. Los cuestionarios repasan comandos, configuraciones y conceptos que suelen aparecer en exámenes y prácticas.', 20)
ON CONFLICT (id) DO NOTHING;

-- Cursos sin nombre conocido (incluidos los que solo tienen cuestionarios en papelera).
INSERT INTO catalog_grades (id, name, short, description, sort_order)
SELECT g.grado, upper(g.grado), 'Cuestionarios de ' || upper(g.grado),
  'Cuestionarios tipo test de ' || upper(g.grado) || ' organizados por asignatura y tema.',
  100 + (ROW_NUMBER() OVER (ORDER BY g.grado))::int
FROM (SELECT DISTINCT grado FROM user_quizzes WHERE grado IS NOT NULL AND grado <> '') g
ON CONFLICT (id) DO NOTHING;

-- Asignaturas: una por (curso, asignatura) presente en los cuestionarios, con el nombre conocido si lo hay.
INSERT INTO catalog_subjects (grade_id, id, name, description, sort_order)
SELECT s.grado, s.course_id,
  COALESCE(k.name, upper(s.course_id)),
  COALESCE(k.description, ''),
  (ROW_NUMBER() OVER (PARTITION BY s.grado ORDER BY s.course_id) * 10)::int
FROM (
  SELECT DISTINCT grado, course_id FROM user_quizzes
  WHERE grado IS NOT NULL AND grado <> '' AND course_id IS NOT NULL AND course_id <> ''
) s
LEFT JOIN (VALUES
  ('digitalizacion', 'Digitalización aplicada a los sectores productivos',
   'Transformación digital de las empresas y tecnologías habilitadoras como el big data, la nube, el IoT o la inteligencia artificial.'),
  ('fuw', 'Fundamentos de hardware',
   'Componentes físicos de los equipos, almacenamiento y sistemas RAID, copias de seguridad, clonación de discos y diseño de centros de proceso de datos (CPD).'),
  ('gtb', 'Gestión de bases de datos',
   'Diseño y consulta de bases de datos relacionales con SQL: consultas básicas, transacciones y niveles de aislamiento.'),
  ('idp', 'Implantación de sistemas operativos',
   'Conceptos de sistemas operativos: funciones, tipos, gestión de procesos, memoria y ficheros, e instalación y configuración.'),
  ('pni', 'Planificación y administración de redes',
   'Redes de ordenadores desde la capa física hasta la de red: señales y medios de transmisión, modelos OSI y TCP/IP, routers, enrutamiento estático y RIPv2.'),
  ('add', 'Administración de sistemas operativos',
   'Administración de servidores y acceso remoto: SSH, VNC, RDP y PowerShell Remoting en entornos Linux y Windows.'),
  ('ade', 'Administración de sistemas gestores de bases de datos',
   'Instalación, configuración y administración de sistemas gestores como MySQL y MariaDB en servidores Linux.')
) AS k(id, name, description) ON k.id = s.course_id
ON CONFLICT (grade_id, id) DO NOTHING;

-- Temas: el id es la parte final de la URL (unidad, o la asignatura si no hay unidad).
-- Nombre inicial: título del cuestionario más reciente (activo antes que en papelera).
INSERT INTO catalog_topics (grade_id, subject_id, id, name, sort_order)
SELECT t.grado, t.course_id, t.topic_id,
  COALESCE(NULLIF(btrim(t.title), ''), upper(t.topic_id)),
  (ROW_NUMBER() OVER (PARTITION BY t.grado, t.course_id ORDER BY t.topic_id) * 10)::int
FROM (
  SELECT DISTINCT ON (grado, course_id, COALESCE(NULLIF(unidad, ''), course_id))
    grado, course_id, COALESCE(NULLIF(unidad, ''), course_id) AS topic_id, title
  FROM user_quizzes
  WHERE grado IS NOT NULL AND grado <> '' AND course_id IS NOT NULL AND course_id <> ''
  ORDER BY grado, course_id, COALESCE(NULLIF(unidad, ''), course_id),
    (deleted_at IS NULL) DESC, created_at DESC, id DESC
) t
ON CONFLICT (grade_id, subject_id, id) DO NOTHING
