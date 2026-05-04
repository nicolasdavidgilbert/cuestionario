# Cuestionarios

Aplicación web de cuestionarios interactivos construida con **Astro + React** y desplegada en **Vercel**.

- Todos los cuestionarios se almacenan en **Neon Postgres**
- Creación desde PDF o JSON con validación automática
- 100% funcional sin registro

---

## Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Desarrollo local
pnpm dev          # → http://localhost:4321

# Build de producción
pnpm build        # → genera /dist
```

---

## Estructura del proyecto

```
cuestionarios/
├── public/
│   ├── catalog.json              # Catálogo de grados y cursos
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Landing.jsx           # Página principal
│   │   ├── Catalog.jsx           # Catálogo por grado
│   │   ├── Quiz.jsx              # Cuestionario interactivo
│   │   ├── CreateQuiz.jsx        # Formulario para subir PDF/JSON
│   │   ├── MyQuizzes.jsx         # Lista de cuestionarios de usuarios
│   │   └── UserQuiz.jsx          # Reproducir cuestionario de usuario
│   ├── layouts/
│   │   └── Layout.astro          # Layout base
│   ├── lib/
│   │   ├── api.ts                # Cliente de API
│   │   ├── quizLimits.ts         # Límites de validación
│   │   └── quizValidator.ts      # Validador de JSON
│   ├── pages/
│   │   ├── index.astro           # Landing
│   │   ├── [grado].astro         # Catálogo por grado
│   │   ├── [grado]/[curso]/[unidad].astro  # Cuestionario
│   │   ├── crear.astro           # Crear cuestionario
│   │   ├── mis-cuestionarios.astro  # Mis cuestionarios
│   │   ├── user-quiz/[id].astro  # Reproducir cuestionario
│   │   └── api/
│   │       ├── quizzes.ts
│   │       ├── quizzes/[id].ts
│   │       ├── quizzes/[id]/report.ts
│   │       ├── generate-quiz-from-pdf.ts
│   │       └── admin/export.ts
│   └── styles/
│       └── global.css            # Estilos
├── migrate-questions.sql         # SQL para importar preguntas existentes
├── neon-setup.sql               # SQL para crear/actualizar tabla
└── package.json
```

---

## Cuestionarios de usuarios

Los usuarios pueden crear sus propios cuestionarios subiendo un PDF, subiendo un archivo JSON o pegando JSON.

### Formato del JSON

```json
{
  "title": "Repaso Tema 1",
  "description": "Cuestionario de ejemplo",
  "grado": "1asir",
  "course_id": "pni",
  "unidad": "ud1",
  "questions": [
    {
      "question": "¿Cuál es la pregunta?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación de la respuesta correcta."
    }
  ]
}
```

### Campos obligatorios

| Campo       | Descripción                           |
|------------|--------------------------------------|
| `grado`    | ID del grado (ej: `1asir`, `1bach`)   |
| `course_id` | ID del curso (ej: `pni`, `digitalizacion`) |
| `questions`| Array con entre 20 y 50 preguntas     |

### Campos opcionales

| Campo         | Descripción                      |
|--------------|--------------------------------|
| `title`       | Título del cuestionario           |
| `description`| Descripción o notas              |
| `unidad`     | ID de unidad (ej: `ud1`, `tema1`)|

### Validación

El sistema valida automáticamente:
- Que sea un JSON válido
- Que tenga los campos obligatorios
- Que cada pregunta tenga 4 opciones
- Que `answer` sea un índice válido (0-3)
- Que no haya opciones vacías

---

## Prompt para generar JSON con IA

Copia este prompt en ChatGPT, Claude, Gemini, etc. junto con el contenido del tema:

```
Necesito que generes un cuestionario tipo test en formato JSON basado en el contenido que te proporcione.

REGLAS:
1. Genera entre 20 y 50 preguntas de tipo test.
2. Cada pregunta debe tener exactamente 4 opciones de respuesta.
3. Solo UNA opción debe ser correcta.
4. Incluye una explicación para cada respuesta correcta.
5. Las opciones incorrectas deben ser plausibles.
6. La respuesta correcta debe estar en posiciones aleatorias (no siempre la primera).

FORMATO JSON:
{
  "title": "Nombre del tema",
  "description": "Descripción opcional",
  "grado": "1asir",
  "course_id": "pni",
  "unidad": "ud1",
  "questions": [
    {
      "question": "Texto de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación breve."
    }
  ]
}

Donde "answer" es el índice (0-3) de la opción correcta.
```

### Cómo usar el JSON generado

1. Ve a `/crear`
2. Arrastra el archivo JSON o pega el contenido
3. Escribe o selecciona grado, curso y unidad
4. Guarda

---

## Base de datos (Neon)

Los cuestionarios se guardan en **Neon Postgres**.

### Tabla (actualizada)

```sql
CREATE TABLE IF NOT EXISTS user_quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  grado TEXT NOT NULL,
  course_id TEXT NOT NULL,
  unidad TEXT DEFAULT '',
  questions JSONB NOT NULL,
  quiz_hash TEXT,
  owner_token TEXT DEFAULT '',
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quizzes_grado ON user_quizzes(grado);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_created ON user_quizzes(created_at DESC);
```

La migración completa actual está en `sql/public-growth-practices.sql`.

### Migrar preguntas existentes

Ejecuta `migrate-questions.sql` para importar las preguntas existentes a la DB.

### Variables de entorno

| Variable      | Descripción              |
|---------------|------------------------|
| `DATABASE_URL`| Connection string de Neon|
| `GROQ_API_KEY`| Clave de Groq para generar desde PDF |
| `GROQ_MODEL`| Modelo de Groq, opcional |
| `ADMIN_API_KEY`| Clave admin para export y borrados admin |

---

## Deploy en Vercel

1. Sube a GitHub
2. Conecta el repo a **Vercel**
3. Añade **Neon** desde **Storage** → **Create Database**
4. Deploy automático en cada push

### Development local

```bash
# Descargar variables de Vercel
vercel env pull .env.local

# Ejecutar
pnpm dev
```

---

## Resumen rápido

| Quiero...                  | Dónde hacerlo             |
|---------------------------|------------------------|
| Practicar con cuestionarios | Navega por los grados    |
| Crear mi cuestionario    | `/crear` → subir PDF o JSON |
| Ver mis cuestionarios    | `/mis-cuestionarios`  |
| Generar preguntas con IA | Copia el prompt de arriba |

---

## Cambios recientes y buenas prácticas añadidas

Esta sección documenta las mejoras añadidas para que la aplicación pueda seguir siendo pública, pero con más control operativo.

La idea principal no es cerrar la app con login. La idea es que cualquiera pueda leer y crear cuestionarios, pero evitando datos rotos, abuso básico y pérdidas accidentales.

### 1. Generación de cuestionarios desde PDF

Archivos principales:

```text
src/pages/api/generate-quiz-from-pdf.ts
src/lib/server/generateQuizFromPdf.ts
src/components/CreateQuiz.jsx
```

Qué hace:

- Permite subir un PDF desde `/crear`.
- Extrae texto con `pdf-parse`.
- Envía el contenido a Groq.
- Pide a la IA un JSON con entre 20 y 50 preguntas.
- Valida el resultado antes de mostrarlo o guardarlo.

Por qué:

- Evita tener que copiar el contenido del temario manualmente.
- Mantiene el mismo formato validado que los JSON subidos a mano.
- Reduce errores porque el JSON generado no se guarda directamente: primero pasa por el validador.

Controles añadidos:

- Solo acepta `.pdf`.
- Límite de 10 MB por PDF.
- Timeout de 45 segundos en la llamada a Groq.
- Mensajes de error controlados.

Variables necesarias:

```env
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

### 2. Validación centralizada

Archivos:

```text
src/lib/quizValidator.ts
src/lib/quizLimits.ts
```

Qué hace:

- Valida que el quiz tenga `grado`, `course_id` y `questions`.
- Exige entre 20 y 50 preguntas.
- Exige exactamente 4 opciones por pregunta.
- Exige que `answer` sea un entero entre 0 y 3.
- Rechaza opciones vacías.
- Rechaza textos demasiado largos.

Por qué:

- Antes el frontend validaba más que el backend.
- Si alguien llamaba directamente a la API, podía guardar datos mal formados.
- Ahora frontend y backend usan las mismas reglas.

### 3. Normalización de slugs

Archivo:

```text
src/lib/slug.ts
```

Qué hace:

- Convierte valores como `grado`, `course_id` y `unidad` a texto limpio en minúsculas.

Por qué:

- Evita duplicados como `1ASIR`, `1asir` y ` 1asir `.
- Hace que rutas, filtros y búsquedas coincidan mejor.

### 4. Variables de entorno centralizadas

Archivo:

```text
src/lib/server/env.ts
```

Qué hace:

- Centraliza lectura de `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL` y `ADMIN_API_KEY`.
- Lanza errores claros cuando falta una variable obligatoria.

Por qué:

- Evita repetir `import.meta.env...` en muchos archivos.
- Hace más fácil saber qué variable falta cuando algo falla.

### 5. Respuestas HTTP y errores consistentes

Archivo:

```text
src/lib/server/http.ts
```

Qué hace:

- Centraliza respuestas JSON.
- Devuelve errores internos con más detalle en desarrollo.
- Oculta detalles técnicos en producción.

Por qué:

- Evita respuestas inconsistentes entre endpoints.
- Reduce riesgo de filtrar información sensible en producción.

### 6. Rate limiting básico

Archivo:

```text
src/lib/server/rateLimit.ts
```

Límites actuales:

| Acción | Límite |
| --- | --- |
| Crear quiz | 20 por hora/IP |
| Generar desde PDF | 5 por hora/IP |
| Reportar quiz | 10 por hora/IP |
| Borrar quiz | 30 por hora/IP |

Por qué:

- La app permite creación pública.
- Sin límites, un bot podría llenar la base de datos o gastar llamadas a Groq.

Limitación:

- Es rate limit en memoria.
- En serverless puede reiniciarse o no compartirse entre instancias.
- Para producción con más tráfico, conviene usar Redis/Upstash o una tabla en Postgres.

### 7. Paginación y búsqueda

Archivo principal:

```text
src/pages/api/quizzes.ts
```

Cliente:

```text
src/lib/api.ts
src/components/MyQuizzes.jsx
```

Qué hace:

- `GET /api/quizzes` acepta `limit`, `offset`, `q` y `grado`.
- Devuelve el total en el header `X-Total-Count`.
- La pantalla `/mis-cuestionarios` permite buscar y paginar.

Ejemplo:

```text
GET /api/quizzes?limit=24&offset=0&q=redes
```

Por qué:

- Cargar todos los cuestionarios funciona al principio, pero escala mal.
- La paginación evita respuestas enormes.
- La búsqueda hace usable el listado cuando crezca.

### 8. Soft delete

Archivos:

```text
src/pages/api/quizzes/[id].ts
sql/public-growth-practices.sql
```

Qué hace:

- Borrar ya no elimina la fila.
- Marca `deleted_at = NOW()`.
- Los listados solo muestran quizzes con `deleted_at IS NULL`.

Por qué:

- Permite recuperar información si se borra algo por error.
- Conserva historial para auditoría.
- Evita pérdidas irreversibles.

### 9. Propiedad ligera con token local

Archivos:

```text
src/lib/ownerToken.ts
src/lib/api.ts
src/components/MyQuizzes.jsx
```

Qué hace:

- Crea un token aleatorio en `localStorage`.
- Ese token se envía al crear un quiz.
- Permite listar “creados en este navegador”.
- Permite borrar esos cuestionarios propios.

Por qué:

- Mantiene la app sin registro.
- Da una forma básica de gestionar lo que uno ha creado.

Limitación:

- Si el usuario borra el navegador/localStorage, pierde ese vínculo.
- No sustituye a una autenticación real.

### 10. Borrado protegido

Archivo:

```text
src/pages/api/quizzes/[id].ts
```

Quién puede borrar:

- El navegador que creó el quiz, mediante `x-owner-token`.
- Un admin, mediante `x-admin-api-key`.

Por qué:

- Cualquiera puede crear, pero no cualquiera debe poder borrar contenido ajeno.

### 11. Deduplicación

Archivo:

```text
src/lib/server/hash.ts
src/pages/api/quizzes.ts
```

Qué hace:

- Calcula un `quiz_hash` con título, grado, curso, unidad y preguntas.
- Rechaza duplicados activos con HTTP `409`.

Por qué:

- Evita que el mismo quiz se cree repetidamente por doble click, reintentos o importaciones duplicadas.

### 12. Reportes de cuestionarios

Archivos:

```text
src/pages/api/quizzes/[id]/report.ts
src/components/UserQuiz.jsx
```

Qué hace:

- Añade un formulario para reportar un cuestionario.
- Guarda el motivo en `quiz_reports`.
- Registra auditoría del reporte.

Por qué:

- En una app pública siempre puede aparecer contenido incorrecto o inapropiado.
- Reportar permite moderar después sin impedir la creación pública.

### 13. Auditoría

Archivo:

```text
src/lib/server/audit.ts
```

Tabla:

```text
audit_logs
```

Eventos actuales:

- `quiz_created`
- `quiz_reported`
- `quiz_soft_deleted`

Por qué:

- Ayuda a saber qué ha pasado si hay problemas.
- Facilita depurar abusos, borrados y actividad anómala.

### 14. Export admin

Archivo:

```text
src/pages/api/admin/export.ts
```

Endpoint:

```text
GET /api/admin/export
```

Requiere header:

```text
x-admin-api-key: <ADMIN_API_KEY>
```

Exporta:

- cuestionarios
- reportes
- últimos eventos de auditoría

Por qué:

- Sirve como backup manual.
- Facilita migrar datos o revisar el estado de la app.

### 15. Migraciones SQL

Archivos:

```text
sql/public-growth-practices.sql
scripts/run-sql.mjs
```

Comando:

```bash
pnpm db:migrate
```

Qué hace:

- Lee `DATABASE_URL` desde `.env`.
- Ejecuta las sentencias de `sql/public-growth-practices.sql`.
- Crea columnas y tablas necesarias para soft delete, reportes, auditoría y deduplicación.

Por qué:

- El código puede requerir columnas nuevas como `deleted_at`.
- Si la base no tiene esas columnas, la API falla.
- Tener un comando documentado evita hacerlo manualmente cada vez.

### 16. Tests

Archivo:

```text
tests/quizValidator.test.mjs
```

Comando:

```bash
pnpm test
```

Qué cubre:

- Acepta un quiz válido.
- Rechaza `answer` no entero.
- Rechaza número inválido de preguntas.
- Rechaza contenido demasiado largo.

Por qué:

- El validador protege la calidad de datos.
- Si se rompe, la app puede guardar quizzes corruptos.

### 17. CI

Archivo:

```text
.github/workflows/ci.yml
```

Qué ejecuta:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm run build
```

Por qué:

- Evita subir cambios que rompan validación o build.
- Da una comprobación automática en pushes y pull requests.

### 18. Archivos ignorados

`.gitignore` ahora ignora:

```text
.env
.astro
dist
node_modules
```

Por qué:

- `.env` contiene secretos.
- `.astro` y `dist` son generados.
- `node_modules` no se versiona.

Si `.env` estuvo trackeado antes, hay que sacarlo del índice:

```bash
git rm --cached -f .env
```

Y si llegó al remoto, hay que rotar esas claves.

### 19. Resumen operativo

Después de clonar o actualizar:

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Antes de subir cambios:

```bash
pnpm test
pnpm build
```

Para probar que la API responde:

```bash
curl http://localhost:4321/api/quizzes
```

Para exportar como admin:

```bash
curl -H "x-admin-api-key: $ADMIN_API_KEY" http://localhost:4321/api/admin/export
```

### 20. Decisión de producto

La app sigue siendo pública:

- Cualquiera puede leer.
- Cualquiera puede crear.
- Cualquiera puede reportar.

Las buenas prácticas añadidas controlan daños sin bloquear el uso:

- Validación evita datos rotos.
- Rate limit reduce abuso.
- Soft delete permite recuperar.
- Reportes permiten moderar.
- Deduplicación reduce ruido.
- Auditoría ayuda a investigar.
- Export facilita backups.
- Token local permite gestión básica sin login.
