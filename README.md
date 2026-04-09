# 📝 Cuestionarios

Aplicación web de cuestionarios interactivos construida con **Astro + React** y desplegada en **Vercel**.

- Cuestionarios estáticos (JSON en repositorio)
- Cuestionarios de usuarios (guardados en **Neon Postgres**)
- Subida de JSON con validación automática
- 100% funcional sin registro

---

## 🚀 Inicio rápido

```bash
# Instalar dependencias
pnpm install

# Desarrollo local
pnpm dev          # → http://localhost:4321

# Build de producción
pnpm build        # → genera /dist
pnpm preview      # → previsualizar el build
```

---

## 📂 Estructura del proyecto

```
cuestionarios/
├── public/
│   ├── questions/                # Cuestionarios estáticos
│   │   ├── 1asir/
│   │   │   ├── pni/ud1.json
│   │   │   └── digitalizacion/ud1.json
│   │   └── 1bach/
│   ├── catalog.json              # Auto-generado
│   └── favicon.svg
├── src/
│   ├── components/               # Componentes React
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
│   ├── pages/                    # Rutas de Astro
│   │   ├── index.astro           # Landing
│   │   ├── [grado].astro         # Catálogo por grado
│   │   ├── [grado]/[curso]/[unidad].astro  # Quiz estático
│   │   ├── crear.astro           # Crear cuestionario
│   │   ├── mis-cuestionarios.astro  # Mis cuestionarios
│   │   ├── user-quiz/[id].astro  # Reproducir cuestionario
│   │   └── api/                  # API routes (serverless)
│   │       ├── quizzes.ts
│   │       └── quizzes/[id].ts
│   └── styles/
│       └── global.css            # Estilos
├── astro.config.mjs
├── neon-setup.sql               # SQL para crear tabla
└── package.json
```

---

## 👥 Cuestionarios de usuarios

Los usuarios pueden crear sus propios cuestionarios subiendo un archivo JSON.

### Formato del JSON

```json
{
  "title": "Repaso Tema 1",
  "description": "Cuestionario de ejemplo",
  "grado": "1asir",
  "course_id": "pni",
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
|-------------|---------------------------------------|
| `grado`     | ID del grado (ej: `1asir`, `1bach`)   |
| `course_id` | ID del curso (ej: `pni`, `digitalizacion`) |
| `questions` | Array con al menos 1 pregunta        |

### Campos opcionales

| Campo         | Descripción                      |
|---------------|----------------------------------|
| `title`       | Título del cuestionario          |
| `description` | Descripción o notas             |

### Validación

El sistema valida automáticamente:
- Que sea un JSON válido
- Que tenga los campos obligatorios
- Que cada pregunta tenga 4 opciones
- Que `answer` sea un índice válido (0-3)
- Que no haya opciones vacías

---

## 🤖 Prompt para generar JSON con IA

Copia este prompt en ChatGPT, Claude, Gemini, etc. junto con el contenido del tema:

````
Necesito que generes un cuestionario tipo test en formato JSON basado en el contenido que te proporcione.

REGLAS:
1. Genera entre 20 y 50 preguntas de tipo test.
2. Cada pregunta debe tener exactamente 4 opciones de respuesta.
3. Solo UNA opción debe ser correcta.
4. Incluye una explicación para cada respuesta correcta.
5. Las opciones incorrectas deben ser plausibles.
6. La respuesta correcta debe estar en posiciones aleatorias (no siempre la primera).

FORMATO JSON:
```json
{
  "title": "Nombre del tema",
  "description": "Descripción opcional",
  "grado": "1asir",
  "course_id": "pni",
  "questions": [
    {
      "question": "Texto de la pregunta",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación breve."
    }
  ]
}
```

Donde "answer" es el índice (0-3) de la opción correcta.
````

### Cómo usar el JSON generado

**Opción 1: Subir desde la web**
1. Ve a `/crear`
2. Arrastra el archivo JSON
3. Selecciona grado y curso
4. Guarda

**Opción 2: Añadir como cuestionario estático**
1. Guarda el JSON en `public/questions/{grado}/{curso}/{unidad}.json`
2. Ejecuta `pnpm dev`

---

## ➕ Añadir cuestionarios estáticos

### Estructura de carpetas

```
public/questions/{grado}/{curso}/{unidad}.json
```

Ejemplo: `public/questions/1asir/pni/ud3.json`

### Formato (legacy - array)

```json
[
    {
        "title": "Unidad Didáctica 1: Nombre del Tema"
    },
    {
        "question": "¿Cuál es la pregunta?",
        "options": ["A", "B", "C", "D"],
        "answer": 0,
        "explanation": "Explicación."
    }
]
```

> **Nota:** La app selecciona 15 preguntas aleatorias por sesión.

---

## 🗄️ Base de datos (Neon)

Los cuestionarios de usuarios se guardan en **Neon Postgres**.

### Tabla

```sql
CREATE TABLE user_quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  grado TEXT NOT NULL,
  course_id TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Variables de entorno

| Variable      | Descripción              |
|---------------|--------------------------|
| `DATABASE_URL`| Connection string de Neon|

---

## 🌐 Deploy en Vercel

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

## 📌 Resumen rápido

| Quiero...                     | Dónde hacerlo                  |
|-------------------------------|-------------------------------|
| Practicar con cuestionarios   | Navega por los grados         |
| Crear mi propio cuestionario  | `/crear` → subir JSON         |
| Ver mis cuestionarios         | `/mis-cuestionarios`          |
| Añadir cuestionario estático  | `public/questions/` + `pnpm dev` |
| Generar preguntas con IA      | Usa el prompt de arriba       |
