# Cuestionarios

Aplicación web de cuestionarios interactivos construida con **Astro + React** y desplegada en **Vercel**.

- Todos los cuestionarios se almacenan en **Neon Postgres**
- Subida de JSON con validación automática
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
│   │   ├── CreateQuiz.jsx        # Formulario para subir JSON
│   │   ├── MyQuizzes.jsx         # Lista de cuestionarios de usuarios
│   │   └── UserQuiz.jsx          # Reproducir cuestionario de usuario
│   ├── layouts/
│   │   └── Layout.astro          # Layout base
│   ├── lib/
│   │   ├── api.ts                # Cliente de API
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
│   │       └── quizzes/[id].ts
│   └── styles/
│       └── global.css            # Estilos
├── migrate-questions.sql         # SQL para importar preguntas existentes
├── neon-setup.sql               # SQL para crear/actualizar tabla
└── package.json
```

---

## Cuestionarios de usuarios

Los usuarios pueden crear sus propios cuestionariossubiendo un archivo JSON.

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
| `questions`| Array con al menos 1 pregunta         |

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_quizzes_grado ON user_quizzes(grado);
CREATE INDEX IF NOT EXISTS idx_user_quizzes_created ON user_quizzes(created_at DESC);
```

### Migrar preguntas existentes

Ejecuta `migrate-questions.sql` para importar las preguntas existentes a la DB.

### Variables de entorno

| Variable      | Descripción              |
|---------------|------------------------|
| `DATABASE_URL`| Connection string de Neon|

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
| Crear mi cuestionario    | `/crear` → subir JSON |
| Ver mis cuestionarios    | `/mis-cuestionarios`  |
| Generar preguntas con IA | Copia el prompt de arriba |